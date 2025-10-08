# Update Instructions for GitHub and Lovable

## 1. Updating GitHub

### Step 1: Stage and Commit Changes
```bash
# Add all new and modified files
git add .

# Commit with detailed message
git commit -m "feat: Enable 200+ PDF batch processing with memory optimization and security enhancements

- Increased batch capacity from ~30 to 200+ PDFs
- Added intelligent client/server routing based on workload
- Implemented chunked processing to prevent memory exhaustion
- Added comprehensive file validation and sanitization
- Enhanced error handling with retry logic
- Added real-time progress tracking
- Optimized database queries with indexes
- Added automatic job cleanup

See IMPLEMENTATION_SUMMARY.md for details"

# Push to your repository
git push origin main
```

### Step 2: Create a GitHub Release (Optional)
1. Go to your repository on GitHub
2. Click "Releases" → "Create a new release"
3. Tag version: `v2.0.0`
4. Release title: "200+ PDF Batch Processing"
5. Description: Copy content from `IMPLEMENTATION_SUMMARY.md`
6. Attach the audit report and implementation summary as assets

## 2. Updating Lovable

### Step 1: Deploy Database Changes
1. Open Lovable dashboard
2. Go to Database section
3. Run the migration:
   - Copy content from `/supabase/migrations/20251008040000_performance_improvements.sql`
   - Execute in SQL editor

### Step 2: Deploy Edge Functions
1. In Lovable dashboard, go to Functions
2. Create new function: `process-pdf-batch-v2`
3. Copy content from `/supabase/functions/process-pdf-batch-v2/index.ts`
4. Deploy the function

### Step 3: Update Application Code
1. In Lovable editor:
   - Create all new files listed in the commit
   - Copy content from each file
   - Save changes

### Step 4: Environment Variables
No new environment variables required

### Step 5: Test Deployment
1. Upload 50 test PDFs
2. Create Excel with merge instructions
3. Process and verify results
4. Check logs for any errors

## 3. Post-Deployment Checklist

- [ ] Database migration executed successfully
- [ ] New Edge Function deployed and accessible
- [ ] All new files created in Lovable
- [ ] Application builds without errors
- [ ] Can process 50+ PDFs without issues
- [ ] Progress tracking shows correctly
- [ ] Error messages display properly
- [ ] Memory usage stays within limits

## 4. Rollback Plan

If issues occur:
1. Revert to original `Index.tsx` (no v2)
2. Keep database changes (they're backward compatible)
3. Original `process-pdf-batch` function still works

## 5. Monitoring

After deployment, monitor:
- Supabase logs for Edge Function errors
- Browser console for client-side errors
- Database for stuck jobs:
  ```sql
  SELECT * FROM processing_jobs 
  WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '1 hour';
  ```

## 6. Communication

### Update README.md
Add to features section:
```markdown
- **Bulk Processing**: Handle up to 200 PDFs in a single batch
- **Smart Processing**: Automatic routing between client and server
- **Memory Safe**: Intelligent chunking prevents browser crashes
- **Progress Tracking**: Real-time updates with batch indicators
```

### Update User Documentation
Add section explaining:
- 200 file limit per batch
- 50MB limit per file
- Expected processing times
- How to split very large batches

## Notes

- The v2 implementation is backward compatible
- Existing users won't see breaking changes
- New UI in IndexV2.tsx can be gradually rolled out
- Consider A/B testing the new implementation