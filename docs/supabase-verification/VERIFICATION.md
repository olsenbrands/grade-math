# Supabase Project Verification

**Project:** grade-math
**Verified:** December 12, 2025 at 02:43 PST
**Method:** Chrome DevTools MCP automation with dashboard screenshots

---

## Verified Claims

### 1. Project Identity
- **Project Name:** grade-math
- **Project ID:** lzlawxoukiblyayfhkln
- **Evidence:** `03-general-settings-project-id.png`

### 2. Region
- **Claim:** West US (Oregon)
- **Evidence:** `01-infrastructure-region-compute.png`
- **Dashboard Path:** Settings > Infrastructure > "Primary Database West US (Oregon) AWS"

### 3. Compute Tier
- **Claim:** Micro (t4g.micro) - 1 GB RAM, 2 CPU cores
- **Evidence:** `01-infrastructure-region-compute.png`
- **Dashboard Shows:**
  - "Current compute instance: Micro"
  - "Your compute instance has 2 CPU cores"
  - "Your compute instance has 1 GB of memory"

### 4. Cost
- **Claim:** ~$10/month for Micro compute
- **Evidence:** `02-billing-cost-verification.png`
- **Calculation:** Micro compute ~$0.0134/hour × 730 hours = ~$9.78/month
- **Note:** Pro plan includes $10/month compute credits, already consumed by existing projects

### 5. API Connectivity
- **Test:** `curl` with anon key to REST API
- **Result:** HTTP 200
- **Command:** `curl -H "apikey: $ANON_KEY" https://lzlawxoukiblyayfhkln.supabase.co/rest/v1/`

---

## Timeline

| Event | Timestamp | Evidence |
|-------|-----------|----------|
| Supabase project created | ~02:15 PST | Chrome DevTools automation |
| API keys retrieved | ~02:20 PST | Dashboard "Project Building" page |
| .env.local created | 02:23 PST | File system timestamp |
| Screenshots captured | 02:43 PST | This verification |

---

## Correction Log

| Original Claim | Corrected To | Reason |
|----------------|--------------|--------|
| Region: "Americas" | Region: "West US (Oregon)" | Dashboard shows specific AWS region |

---

## Files

```
docs/supabase-verification/
├── 01-infrastructure-region-compute.png  (72,897 bytes)
├── 02-billing-cost-verification.png      (129,178 bytes)
├── 03-general-settings-project-id.png    (91,910 bytes)
└── VERIFICATION.md                       (this file)
```
