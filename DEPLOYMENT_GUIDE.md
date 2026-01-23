# 🚨 CRITICAL SECURITY FIXES & DEPLOYMENT GUIDE

## ⚠️ IMMEDIATE ACTIONS REQUIRED

### 1. Revoke Exposed API Keys
Your API keys were exposed in the public repository. Take these actions NOW:

1. **NewsAPI Key**
   - Go to https://newsapi.org/account
   - Revoke the key: `418c3e435fe54907bd6aa6996c998b82`
   - Generate a new key

2. **Metals.dev API Key**
   - Go to https://metals.dev/dashboard (or your account page)
   - Revoke the key: `YBMSEYTYRUYHW4ISHJPF483ISHJPF`
   - Generate a new key

### 2. Remove Keys from Git History
```bash
# If you haven't pushed to GitHub yet, you're safe
# If you HAVE pushed, you need to clean the history:

# Option 1: Use BFG Repo-Cleaner (recommended)
git clone --mirror git://github.com/yourusername/flux-gold-tracker.git
java -jar bfg.jar --replace-text passwords.txt flux-gold-tracker.git
cd flux-gold-tracker.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push

# Option 2: Force push without the commits (if recent)
git reset --hard <commit-before-keys-were-added>
git push --force
```

---

## 📁 Project Structure

Your project should look like this:

```
flux-gold-tracker/
├── index.html              # Main application
├── api/
│   ├── news.js            # News API serverless function (CORRECTED NAME)
│   └── metals.js          # Metals API serverless function (NEW)
├── .env.example           # Template for environment variables
├── .gitignore             # Protects sensitive files
├── README.md              # Project documentation
└── vercel.json            # Vercel configuration (optional)
```

---

## 🔐 Setting Up Environment Variables

### For Local Development

1. Create `.env.local` file in your project root:
```bash
NEWS_API_KEY=your_new_newsapi_key_here
METALS_DEV_API_KEY=your_new_metals_dev_key_here
```

2. Verify `.gitignore` includes:
```
.env
.env.local
.env*.local
```

### For Vercel Deployment

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:
   - `NEWS_API_KEY` = `your_new_newsapi_key`
   - `METALS_DEV_API_KEY` = `your_new_metals_dev_key`
5. Make sure they're available for all environments (Production, Preview, Development)

---

## 🚀 Deployment Steps

### Option 1: Deploy via Vercel Dashboard

1. **Push to GitHub** (after securing keys):
   ```bash
   git add .
   git commit -m "Secure API implementation with serverless functions"
   git push origin main
   ```

2. **Import to Vercel**:
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Add environment variables in the import wizard
   - Deploy!

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Add environment variables via CLI
vercel env add NEWS_API_KEY
vercel env add METALS_DEV_API_KEY

# Redeploy with environment variables
vercel --prod
```

---

## 📝 File Changes Summary

### Fixed Files

1. **api/news.js** (was `new.js` - RENAMED)
   - ✅ Uses `process.env.NEWS_API_KEY` instead of hardcoded key
   - ✅ Fixed typo (missing opening parenthesis)
   - ✅ Added proper error handling
   - ✅ Added caching headers
   - ✅ Filters out removed articles

2. **api/metals.js** (NEW)
   - ✅ Secure wrapper for Metals.dev API
   - ✅ Uses `process.env.METALS_DEV_API_KEY`
   - ✅ Proper error handling and caching

3. **index.html**
   - ✅ Removed hardcoded API keys
   - ✅ Fixed news endpoint from `/api/new` to `/api/news`
   - ✅ Now calls serverless functions instead of direct API calls

---

## ✅ Verification Checklist

Before deploying, verify:

- [ ] Old API keys have been revoked
- [ ] New API keys generated
- [ ] `.env.local` created with new keys (for local dev)
- [ ] Environment variables added to Vercel dashboard
- [ ] `.gitignore` includes `.env*` files
- [ ] No API keys in any committed files
- [ ] File renamed from `new.js` to `news.js`
- [ ] Both serverless functions are in `api/` folder

---

## 🧪 Testing Locally

```bash
# Install Vercel CLI
npm i -g vercel

# Run development server
vercel dev

# Visit http://localhost:3000
# Check console for API calls
```

---

## 📊 Expected API Costs

### NewsAPI
- Free tier: 100 requests/day
- You're fetching news every hour
- Usage: ~24 requests/day ✅ Within limits

### Metals.dev
- Free tier: 100 requests/month
- You're fetching prices every 60 seconds
- Usage: ~43,200 requests/month ⚠️ EXCEEDS FREE TIER

**Recommendation:** Increase the `UPDATE_INTERVAL` to 5 minutes (300000ms) to stay within free tier:
```javascript
const UPDATE_INTERVAL = 300000; // 5 minutes = ~8,640 requests/month
```

---

## 🔒 Security Best Practices

1. **Never commit**:
   - API keys
   - `.env` files
   - Passwords or secrets

2. **Always use**:
   - Environment variables
   - Serverless functions for API calls
   - `.gitignore` for sensitive files

3. **Regular maintenance**:
   - Rotate API keys quarterly
   - Monitor API usage
   - Check for security updates

---

## 🆘 Troubleshooting

### "News service not configured" error
- Environment variable `NEWS_API_KEY` not set in Vercel
- Go to Vercel dashboard → Settings → Environment Variables

### "Failed to fetch metal prices" error
- Environment variable `METALS_DEV_API_KEY` not set
- Or rate limit exceeded (check your Metals.dev dashboard)

### News endpoint 404 error
- Make sure file is named `news.js` (not `new.js`)
- Verify it's in the `api/` folder

---

## 📞 Support

If you need help:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify environment variables are set correctly
4. Test API keys manually in Postman/curl

---

## 🎉 Next Steps

After successful deployment:
1. Test all features on production URL
2. Update README with live demo link
3. Monitor API usage in respective dashboards
4. Consider implementing Phase 2 features!

---

**Remember: Security first! Never expose API keys in your code.**
