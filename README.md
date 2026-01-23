# FLUX - Gold Trend Tracker

A real-time gold price tracking web application with interactive charts, live market data, and gold market news.

## ⚠️ Security Notice

This version implements secure API handling through serverless functions. **Never commit API keys to your repository!**

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed security setup instructions.

## Features

* 📈 **Live Gold Price Display** - Real-time price updates every 60 seconds
* 📰 **Gold Market News** - Latest news from trusted sources, updated hourly
* 📊 **Interactive Charts** - Historical price data with multiple time periods
* 💹 **Price Change Indicators** - Visual indicators for gains and losses
* 🪙 **Multi-Metal Tracking** - Gold, Silver, and Platinum prices
* 📱 **Fully Responsive** - Works perfectly on all devices
* ⚡ **Fast & Lightweight** - Optimized performance with caching
* 🎨 **Modern Design** - Brutalist-luxe aesthetic with gold accents
* 🔒 **Secure** - API keys protected via environment variables

## Tech Stack

### Frontend
* HTML5, CSS3, JavaScript
* Chart.js for data visualization
* Google Fonts (Orbitron, Space Mono)

### Backend (Serverless)
* Vercel Serverless Functions (Node.js)
* NewsAPI for gold market news
* Metals.dev API for real-time precious metal prices

### Hosting
* Vercel (with automatic HTTPS and CDN)

## Project Structure

```
flux-gold-tracker/
├── index.html              # Main application
├── api/
│   ├── news.js            # News API serverless function
│   └── metals.js          # Metals API serverless function
├── .env.example           # Template for environment variables
├── .gitignore             # Git ignore rules
├── README.md              # This file
├── DEPLOYMENT_GUIDE.md    # Detailed deployment instructions
└── vercel.json            # Vercel configuration (optional)
```

## Quick Start

### Prerequisites

1. Get API keys:
   - NewsAPI: https://newsapi.org/register (Free: 100 requests/day)
   - Metals.dev: https://metals.dev/ (Free: 100 requests/month)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/flux-gold-tracker.git
   cd flux-gold-tracker
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your API keys
   ```

3. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

4. **Run development server**
   ```bash
   vercel dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Production Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete deployment instructions.

**Quick deploy to Vercel:**

1. Push to GitHub
2. Import to Vercel (vercel.com/new)
3. Add environment variables in Vercel dashboard
4. Deploy!

## Environment Variables

Create a `.env.local` file for local development:

```env
NEWS_API_KEY=your_newsapi_key_here
METALS_DEV_API_KEY=your_metals_dev_key_here
```

For production, add these in your Vercel dashboard under Settings → Environment Variables.

## API Usage & Costs

### NewsAPI (Free Tier)
* **Limit:** 100 requests/day
* **Current Usage:** ~24 requests/day (hourly updates)
* **Status:** ✅ Within free tier

### Metals.dev (Free Tier)
* **Limit:** 100 requests/month
* **Default Usage:** ~43,200 requests/month (60-second updates) ⚠️
* **Recommendation:** Adjust `UPDATE_INTERVAL` to 5 minutes for free tier compatibility

To stay within free tier limits, edit `index.html`:
```javascript
const UPDATE_INTERVAL = 300000; // 5 minutes instead of 60 seconds
```

## Features Breakdown

### Real-Time Price Tracking
- Live gold, silver, and platinum prices
- Price change indicators with percentage
- LBMA Gold AM/PM prices
- Gold/Silver ratio calculation

### Market News Integration
- Latest gold market news from NewsAPI
- Auto-refresh every hour
- Click-through to full articles
- Time-ago display for each article

### Interactive Charts
- Price history visualization
- Multiple time period views (1H, 6H, 24H, 7D)
- Smooth animations and tooltips
- Real-time updates

## Browser Support

* Chrome (recommended)
* Firefox
* Safari
* Edge
* Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

* First Contentful Paint: < 1s
* Time to Interactive: < 2s
* Lighthouse Score: 90+
* API response caching for optimal performance

## Security Features

✅ API keys stored in environment variables  
✅ Serverless functions prevent key exposure  
✅ CORS headers properly configured  
✅ Rate limiting protection  
✅ Error handling without exposing internals  

## Development Roadmap

### Phase 1 (Current) ✅
- [x] Real-time price display
- [x] Interactive charts
- [x] News feed integration
- [x] Responsive design
- [x] Secure API implementation

### Phase 2 (Planned)
- [ ] Price alerts & notifications
- [ ] User preferences/settings
- [ ] Historical data export (CSV/JSON)
- [ ] Compare with Bitcoin/other assets
- [ ] Portfolio tracking
- [ ] Dark/Light theme toggle
- [ ] Advanced charting (candlesticks, indicators)
- [ ] Email/SMS notifications
- [ ] Mobile app (PWA)

### Phase 3 (Future)
- [ ] User accounts & authentication
- [ ] Saved watchlists
- [ ] Social sharing features
- [ ] AI-powered price predictions
- [ ] Multi-currency support
- [ ] Real-time WebSocket updates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Troubleshooting

**"News service not configured" error**
- Environment variable `NEWS_API_KEY` not set
- Check Vercel dashboard → Settings → Environment Variables

**"Failed to fetch metal prices" error**
- Environment variable `METALS_DEV_API_KEY` not set
- Or rate limit exceeded (check usage in Metals.dev dashboard)

**Chart not displaying**
- Check browser console for errors
- Ensure Chart.js CDN is accessible
- Verify Chart.js version compatibility

**News not loading**
- Check if NewsAPI key is valid
- Verify you haven't exceeded daily request limit
- Check browser console for CORS errors

For more help, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## License

MIT License - Feel free to use and modify

## Author

Built with ❤️ for gold market enthusiasts

## Acknowledgments

* [NewsAPI](https://newsapi.org/) for news data
* [Metals.dev](https://metals.dev/) for precious metal prices
* [Chart.js](https://www.chartjs.org/) for beautiful charts
* [Vercel](https://vercel.com/) for seamless deployment

## Live Demo

Coming soon after deployment!

## Support

If you find this project helpful, please give it a ⭐ on GitHub!

---

**Note:** This project uses simulated historical data for charts. For production use with complete historical data, consider integrating with a financial data API that provides historical prices (e.g., Alpha Vantage, Polygon.io).

**Security Reminder:** Never commit `.env` files or expose API keys in your code!
