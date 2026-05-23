// Unified error handling middleware for Edge Functions
export interface EdgeFunctionError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

export const ErrorCodes = {
  // Authentication errors
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
  INVALID_TOKEN: { code: 'INVALID_TOKEN', message: 'Invalid authentication token', statusCode: 401 },
  
  // Validation errors
  INVALID_REQUEST: { code: 'INVALID_REQUEST', message: 'Invalid request data', statusCode: 400 },
  MISSING_PARAMS: { code: 'MISSING_PARAMS', message: 'Missing required parameters', statusCode: 400 },
  FILE_TOO_LARGE: { code: 'FILE_TOO_LARGE', message: 'File size exceeds limit', statusCode: 413 },
  INVALID_FILE_TYPE: { code: 'INVALID_FILE_TYPE', message: 'Invalid file type', statusCode: 400 },
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests', statusCode: 429 },
  
  // Processing errors
  PROCESSING_FAILED: { code: 'PROCESSING_FAILED', message: 'Processing failed', statusCode: 500 },
  JOB_NOT_FOUND: { code: 'JOB_NOT_FOUND', message: 'Job not found', statusCode: 404 },
  JOB_TIMEOUT: { code: 'JOB_TIMEOUT', message: 'Job timed out', statusCode: 504 },
  
  // Storage errors
  STORAGE_ERROR: { code: 'STORAGE_ERROR', message: 'Storage operation failed', statusCode: 500 },
  FILE_NOT_FOUND: { code: 'FILE_NOT_FOUND', message: 'File not found', statusCode: 404 },
  
  // Server errors
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable', statusCode: 503 },
} as const;

export class EdgeError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(errorType: typeof ErrorCodes[keyof typeof ErrorCodes], details?: any) {
    super(errorType.message);
    this.name = 'EdgeError';
    this.code = errorType.code;
    this.statusCode = errorType.statusCode;
    this.details = details;
  }
}

// Error response formatter
export function formatErrorResponse(error: Error | EdgeError): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (error instanceof EdgeError) {
    return new Response(
      JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      }),
      {
        status: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

// Request validation middleware
export async function validateRequest(
  req: Request,
  schema: {
    body?: any;
    headers?: string[];
    method?: string;
  }
): Promise<void> {
  // Validate method
  if (schema.method && req.method !== schema.method) {
    throw new EdgeError(ErrorCodes.INVALID_REQUEST, {
      expected: schema.method,
      received: req.method,
    });
  }

  // Validate headers
  if (schema.headers) {
    for (const header of schema.headers) {
      if (!req.headers.get(header)) {
        throw new EdgeError(ErrorCodes.MISSING_PARAMS, {
          missingHeader: header,
        });
      }
    }
  }

  // Validate body
  if (schema.body && req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      const body = await req.json();
      
      // Simple validation - check required fields
      for (const [key, type] of Object.entries(schema.body)) {
        if (!(key in body)) {
          throw new EdgeError(ErrorCodes.MISSING_PARAMS, {
            missingField: key,
          });
        }
        
        if (type === 'array' && !Array.isArray(body[key])) {
          throw new EdgeError(ErrorCodes.INVALID_REQUEST, {
            field: key,
            expected: 'array',
            received: typeof body[key],
          });
        }
      }
    } catch (err) {
      if (err instanceof EdgeError) throw err;
      
      throw new EdgeError(ErrorCodes.INVALID_REQUEST, {
        message: 'Invalid JSON body',
      });
    }
  }
}

// Rate limiting middleware
interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyGenerator: (req: Request) => string;
}

const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  req: Request,
  options: RateLimitOptions
): Promise<void> {
  const key = options.keyGenerator(req);
  const now = Date.now();
  
  const limit = rateLimitCache.get(key);
  
  if (limit && limit.resetAt > now) {
    if (limit.count >= options.maxRequests) {
      throw new EdgeError(ErrorCodes.RATE_LIMIT_EXCEEDED, {
        retryAfter: new Date(limit.resetAt).toISOString(),
      });
    }
    
    limit.count++;
  } else {
    rateLimitCache.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
  }
  
  // Clean up old entries
  for (const [k, v] of rateLimitCache.entries()) {
    if (v.resetAt < now) {
      rateLimitCache.delete(k);
    }
  }
}

// Error logging middleware
export async function logError(
  error: Error,
  context: {
    functionName: string;
    userId?: string;
    operation?: string;
    [key: string]: any;
  }
): Promise<void> {
  const errorLog = {
    functionName: context.functionName,
    userId: context.userId,
    operation: context.operation,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    },
    context,
    timestamp: new Date().toISOString(),
  };

  console.error('Function error:', errorLog);
  
  // Could send to external logging service here
}

// Wrapper for Edge Functions with error handling
export function withErrorHandling(
  functionName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          },
        });
      }
      
      return await handler(req);
    } catch (error) {
      await logError(error as Error, { functionName });
      return formatErrorResponse(error as Error);
    }
  };
}