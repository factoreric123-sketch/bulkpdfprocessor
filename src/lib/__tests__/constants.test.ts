import { describe, it, expect } from 'vitest';
import { FILE_PROCESSING, SECURITY } from '../constants';

describe('constants', () => {
  it('should have reasonable file limits', () => {
    expect(FILE_PROCESSING.MAX_FILE_SIZE).toBe(50 * 1024 * 1024); // 50MB
    expect(FILE_PROCESSING.MAX_FILES_PER_BATCH).toBe(200);
    expect(FILE_PROCESSING.MAX_TOTAL_SIZE).toBeGreaterThan(FILE_PROCESSING.MAX_FILE_SIZE);
  });

  it('should have valid retry configuration', () => {
    expect(FILE_PROCESSING.MAX_RETRIES).toBeGreaterThan(0);
    expect(FILE_PROCESSING.RETRY_DELAY).toBeGreaterThan(0);
    expect(FILE_PROCESSING.RETRY_MULTIPLIER).toBeGreaterThanOrEqual(1);
  });

  it('should only allow safe file extensions', () => {
    expect(SECURITY.ALLOWED_EXTENSIONS).toContain('.pdf');
    expect(SECURITY.ALLOWED_EXTENSIONS).not.toContain('.exe');
    expect(SECURITY.ALLOWED_EXTENSIONS).not.toContain('.bat');
  });
});