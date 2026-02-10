# Cost Optimization Guide

Comprehensive guide to minimizing API costs while maintaining high classification accuracy.

## Overview

The Contact Classifier uses a multi-tiered approach to minimize costs:

1. **Rules Engine First** (Free)
2. **Enrichment On-Demand** (Low cost)
3. **AI Classification** (Higher cost, used strategically)
4. **Caching** (Reduces repeated costs)
5. **Budget Caps** (Hard limits)

## Cost Breakdown

### Typical 1000-Row Job

**Scenario: Well-structured CSV with clear business names**

| Component | Usage | Cost |
|-----------|-------|------|
| Rules Classification | 700 rows (70%) | $0.00 |
| Web Search (Bing) | 150 queries | ~$0.75 |
| Google Maps API | 100 queries | ~$0.50 |
| OpenAI (gpt-4o-mini) | 200 rows × 500 tokens | ~$0.02 |
| OpenAI (gpt-4o) | 50 rows × 500 tokens | ~$0.25 |
| **Total** | | **~$1.52** |

**Scenario: Poorly structured CSV with minimal information**

| Component | Usage | Cost |
|-----------|-------|------|
| Rules Classification | 200 rows (20%) | $0.00 |
| Web Search (Bing) | 500 queries (cap reached) | ~$2.50 |
| Google Maps API | 400 queries | ~$2.00 |
| OpenAI (gpt-4o-mini) | 500 rows × 600 tokens | ~$0.06 |
| OpenAI (gpt-4o) | 300 rows × 600 tokens | ~$1.50 |
| **Total** | | **~$6.06** |

## Configuration Strategies

### Strategy 1: Maximum Cost Savings (Lower Accuracy)

```env
RULE_ACCEPT_THRESHOLD=70        # Lower threshold = more rules classifications
RULE_MARGIN_THRESHOLD=10        # Lower margin = accept closer matches
AI_ACCEPT_THRESHOLD=60          # Accept lower AI confidence
MAX_AI_ROWS_PERCENT=40          # Limit AI to 40% of rows
MAX_SEARCH_CALLS_PER_JOB=200    # Reduce search calls
MAX_AI_TOKENS_PER_JOB=500000    # Lower token budget
OPENAI_MODEL_PRIMARY=gpt-4o-mini
OPENAI_MODEL_SECONDARY=gpt-4o-mini  # Don't escalate to expensive model
```

**Expected Results:**
- Cost: ~$0.50-$2.00 per 1000 rows
- Accuracy: 75-85%
- Needs Review: 20-30%

### Strategy 2: Balanced (Recommended)

```env
RULE_ACCEPT_THRESHOLD=80
RULE_MARGIN_THRESHOLD=15
AI_ACCEPT_THRESHOLD=70
MAX_AI_ROWS_PERCENT=60
MAX_SEARCH_CALLS_PER_JOB=500
MAX_AI_TOKENS_PER_JOB=1000000
OPENAI_MODEL_PRIMARY=gpt-4o-mini
OPENAI_MODEL_SECONDARY=gpt-4o
```

**Expected Results:**
- Cost: ~$1.50-$4.00 per 1000 rows
- Accuracy: 85-92%
- Needs Review: 10-15%

### Strategy 3: Maximum Accuracy (Higher Cost)

```env
RULE_ACCEPT_THRESHOLD=90        # Very high confidence required
RULE_MARGIN_THRESHOLD=20        # Large margin required
AI_ACCEPT_THRESHOLD=80          # High AI confidence required
MAX_AI_ROWS_PERCENT=80          # Allow more AI usage
MAX_SEARCH_CALLS_PER_JOB=1000   # More enrichment
MAX_AI_TOKENS_PER_JOB=2000000   # Higher token budget
OPENAI_MODEL_PRIMARY=gpt-4o     # Start with better model
OPENAI_MODEL_SECONDARY=gpt-4o
```

**Expected Results:**
- Cost: ~$5.00-$12.00 per 1000 rows
- Accuracy: 92-97%
- Needs Review: 3-8%

## Optimization Techniques

### 1. Improve CSV Quality

**Before uploading, ensure:**
- `Activités` field is populated with business type
- Email addresses use business domains (not gmail.com)
- Company names are clear and descriptive
- Location fields (Ville, Pays) are filled

**Impact**: Can increase rules classification rate from 30% to 70%+

### 2. Use Caching Effectively

**Enrichment Cache:**
- Reuses web search results for similar contacts
- TTL: 30 days (configurable)
- Key: domain + city + country

**AI Cache:**
- Reuses AI responses for identical inputs
- TTL: 90 days (configurable)
- Key: hash of normalized contact + enrichment

**Impact**: 40-60% cost reduction on repeated/similar data

### 3. Batch Processing

Process multiple CSVs in sequence to benefit from caching:

```
Job 1: 1000 rows → $4.00
Job 2: 1000 rows (similar data) → $1.50 (cache hits)
Job 3: 1000 rows (similar data) → $1.00 (more cache hits)
```

### 4. Staged Enrichment

The system uses 3 enrichment depths:

- **Depth 1**: Web search only (cheapest)
- **Depth 2**: + Google Maps categories
- **Depth 3**: + Website metadata

Most rows only need Depth 1. Depth 2-3 triggered only for low confidence.

### 5. Rules Engine Tuning

Add custom keywords for your specific industry:

Edit `supabase/functions/_shared/rules-engine.ts`:

```typescript
const CLIENT_KEYWORDS = {
  high: [
    'client', 'customer',
    // Add your industry-specific terms:
    'patient', 'member', 'subscriber'
  ],
  // ...
};
```

**Impact**: Can increase rules classification by 10-20%

## Monitoring Costs

### Real-Time Monitoring

Each job shows:
- AI Usage %
- Search Calls Count
- Estimated Token Usage
- Estimated Cost (if configured)

### Monthly Cost Tracking

```sql
-- Get cost summary for last 30 days
SELECT
  COUNT(*) as total_jobs,
  SUM(total_rows) as total_rows_processed,
  SUM(ai_rows) as total_ai_rows,
  AVG(ai_usage_percent) as avg_ai_usage_percent,
  SUM(search_calls_count) as total_search_calls,
  SUM(ai_tokens_estimate) as total_tokens
FROM jobs
WHERE created_at > NOW() - INTERVAL '30 days'
  AND status = 'COMPLETED';
```

### Cost Alerts

Set up alerts in your API dashboards:

**OpenAI:**
- Usage limits: $50/month (adjust as needed)
- Email alerts at 80% threshold

**Bing Search:**
- Monitor transaction count
- Alert at 80% of monthly quota

**Google Maps:**
- Set budget alerts in Google Cloud Console

## Cost Reduction Checklist

- [ ] CSV data is clean and well-structured
- [ ] `Activités` field is populated for most rows
- [ ] Email domains are business domains (not personal)
- [ ] Rules engine keywords match your industry
- [ ] Caching is enabled (check TTL settings)
- [ ] Budget caps are set appropriately
- [ ] Using gpt-4o-mini as primary model
- [ ] Monitoring API usage dashboards
- [ ] Processing similar CSVs in batches
- [ ] Reviewing "Needs Review" items to improve rules

## Advanced: Custom Rules

For recurring CSV uploads with similar patterns, create custom classification rules:

1. Analyze first batch results
2. Identify common patterns in each category
3. Add keywords to rules engine
4. Redeploy Edge Functions
5. Reprocess with improved rules

**Example:**

If you notice many medical clinics are being sent to AI, add:

```typescript
const PRESCRIBER_KEYWORDS = {
  high: [
    // ... existing keywords
    'cabinet', 'centre médical', 'polyclinique'
  ]
};
```

## ROI Calculation

**Manual Classification:**
- Time: 30 seconds per contact
- Cost: $20/hour labor
- 1000 contacts = 8.3 hours = $166

**Automated Classification:**
- Time: 5-10 minutes
- Cost: $1.50-$6.00
- Savings: $160-$164 per 1000 contacts

**Break-even:** After ~10 contacts, automation is cheaper than manual work.

## FAQ

**Q: Why is my AI usage so high?**
A: Check if `Activités` field is populated. Empty or vague activity descriptions force AI usage.

**Q: Can I use a different search API?**
A: Yes, modify `supabase/functions/_shared/enrichment.ts` to use SerpAPI or Google Programmable Search.

**Q: How do I reduce "Needs Review" count?**
A: Increase `AI_ACCEPT_THRESHOLD` or use stronger AI model, but this increases cost.

**Q: Is there a free tier?**
A: Supabase and Vercel have free tiers. OpenAI and search APIs require payment.

---

**Remember**: The goal is to find the right balance between cost and accuracy for your specific use case. Start with the Balanced strategy and adjust based on your results.
