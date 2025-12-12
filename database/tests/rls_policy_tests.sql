-- Grade Math RLS Policy Tests
-- Run these in Supabase SQL Editor to verify RLS policies
--
-- IMPORTANT: Run each section as a different authenticated user
-- to verify cross-user data isolation

-- ============================================
-- TEST SETUP
-- ============================================

-- Create test users (run as service role)
-- User A: test-user-a@example.com
-- User B: test-user-b@example.com

-- ============================================
-- TEST 1: Profiles Table
-- ============================================

-- As User A: Should see only own profile
SELECT * FROM profiles WHERE id = auth.uid();
-- Expected: 1 row (own profile)

SELECT * FROM profiles;
-- Expected: 1 row (own profile only, not User B's)

-- As User A: Should be able to update own profile
UPDATE profiles SET full_name = 'Test User A' WHERE id = auth.uid();
-- Expected: Success

-- As User A: Should NOT be able to update other user's profile
UPDATE profiles SET full_name = 'Hacked' WHERE id != auth.uid();
-- Expected: 0 rows affected

-- ============================================
-- TEST 2: Projects Table
-- ============================================

-- As User A: Create a project
INSERT INTO projects (user_id, name, description)
VALUES (auth.uid(), 'User A Project', 'Test project');
-- Expected: Success

-- As User A: Should see only own projects
SELECT * FROM projects;
-- Expected: Only User A's projects

-- As User B: Should NOT see User A's projects
SELECT * FROM projects;
-- Expected: Empty or only User B's projects

-- As User B: Should NOT be able to modify User A's projects
UPDATE projects SET name = 'Hacked' WHERE user_id != auth.uid();
-- Expected: 0 rows affected

DELETE FROM projects WHERE user_id != auth.uid();
-- Expected: 0 rows affected

-- ============================================
-- TEST 3: Student Roster Table
-- ============================================

-- As User A: Create students
INSERT INTO student_roster (user_id, name) VALUES (auth.uid(), 'John Smith');
INSERT INTO student_roster (user_id, name) VALUES (auth.uid(), 'Jane Doe');
-- Expected: Success

-- As User B: Should NOT see User A's students
SELECT * FROM student_roster;
-- Expected: Empty or only User B's students

-- As User B: Should NOT be able to modify User A's students
DELETE FROM student_roster WHERE user_id != auth.uid();
-- Expected: 0 rows affected

-- ============================================
-- TEST 4: Submissions Table (via project ownership)
-- ============================================

-- As User A: Get own project ID
-- (Use actual project ID from Test 2)

-- As User A: Create submission in own project
INSERT INTO submissions (project_id, storage_path)
VALUES ('USER_A_PROJECT_ID', 'user-a-id/submission1.jpg');
-- Expected: Success

-- As User B: Should NOT see User A's submissions
SELECT * FROM submissions;
-- Expected: Empty or only User B's submissions

-- As User B: Should NOT be able to insert into User A's project
INSERT INTO submissions (project_id, storage_path)
VALUES ('USER_A_PROJECT_ID', 'hacked.jpg');
-- Expected: RLS violation error

-- ============================================
-- TEST 5: Answer Keys Table (via project ownership)
-- ============================================

-- As User A: Create answer key for own project
INSERT INTO project_answer_keys (project_id, type, answers)
VALUES ('USER_A_PROJECT_ID', 'manual', '[{"question": 1, "answer": "42"}]');
-- Expected: Success

-- As User B: Should NOT see User A's answer keys
SELECT * FROM project_answer_keys;
-- Expected: Empty

-- As User B: Should NOT be able to access User A's answer keys
INSERT INTO project_answer_keys (project_id, type)
VALUES ('USER_A_PROJECT_ID', 'manual');
-- Expected: RLS violation error

-- ============================================
-- TEST 6: Graded Results Table (via submission ownership)
-- ============================================

-- As User A: Get own submission ID
-- (Use actual submission ID from Test 4)

-- Note: Graded results are typically inserted by service role
-- but users should be able to SELECT their own

-- As User A: Should see results for own submissions
SELECT * FROM graded_results;
-- Expected: Results for User A's submissions only

-- ============================================
-- TEST 7: Token Ledger Table (read-only for users)
-- ============================================

-- As User A: Should see own token history
SELECT * FROM token_ledger WHERE user_id = auth.uid();
-- Expected: User A's transactions

-- As User A: Should NOT see other users' tokens
SELECT * FROM token_ledger WHERE user_id != auth.uid();
-- Expected: Empty

-- As User A: Should NOT be able to insert tokens
INSERT INTO token_ledger (user_id, amount, balance_after, operation)
VALUES (auth.uid(), 1000, 1000, 'purchase');
-- Expected: RLS violation (no INSERT policy)

-- ============================================
-- TEST 8: Processing Queue Table (service role only)
-- ============================================

-- As User A: Should NOT be able to access processing queue
SELECT * FROM processing_queue;
-- Expected: Empty (no RLS policies = service role only)

INSERT INTO processing_queue (submission_id, status)
VALUES ('some-uuid', 'queued');
-- Expected: RLS violation

-- ============================================
-- TEST 9: Storage Policies
-- ============================================

-- As User A: Upload to own folder
-- Use Supabase client: storage.from('submissions').upload('USER_A_ID/file.jpg', file)
-- Expected: Success

-- As User A: Try to upload to User B's folder
-- Use Supabase client: storage.from('submissions').upload('USER_B_ID/file.jpg', file)
-- Expected: Policy violation error

-- As User A: Try to read User B's files
-- Use Supabase client: storage.from('submissions').download('USER_B_ID/file.jpg')
-- Expected: Policy violation error

-- ============================================
-- TEST SUMMARY CHECKLIST
-- ============================================

/*
Run each test and mark as passed:

[ ] TEST 1: Profiles - Users can only see/edit own profile
[ ] TEST 2: Projects - Users can only see/edit own projects
[ ] TEST 3: Student Roster - Users can only see/edit own students
[ ] TEST 4: Submissions - Access only via project ownership
[ ] TEST 5: Answer Keys - Access only via project ownership
[ ] TEST 6: Graded Results - Access only via submission ownership
[ ] TEST 7: Token Ledger - Read-only for own transactions
[ ] TEST 8: Processing Queue - No user access (service role only)
[ ] TEST 9: Storage - Files isolated by user folder

All tests passing = RLS policies working correctly
*/

-- ============================================
-- CLEANUP (run as service role)
-- ============================================

-- DELETE FROM token_ledger WHERE user_id IN ('user-a-id', 'user-b-id');
-- DELETE FROM graded_results WHERE submission_id IN (SELECT id FROM submissions WHERE project_id IN (SELECT id FROM projects WHERE user_id IN ('user-a-id', 'user-b-id')));
-- DELETE FROM submissions WHERE project_id IN (SELECT id FROM projects WHERE user_id IN ('user-a-id', 'user-b-id'));
-- DELETE FROM project_answer_keys WHERE project_id IN (SELECT id FROM projects WHERE user_id IN ('user-a-id', 'user-b-id'));
-- DELETE FROM projects WHERE user_id IN ('user-a-id', 'user-b-id');
-- DELETE FROM student_roster WHERE user_id IN ('user-a-id', 'user-b-id');
-- DELETE FROM profiles WHERE id IN ('user-a-id', 'user-b-id');
