# 🚀 Application Roadmap & Feature Ideas

This document tracks upcoming features to enhance the Shared Shopping List app's utility, collaboration, and monetization.

## 🛠️ Smart Utility (Phase 1)
- [ ] **Automatic Aisle Categorization**: Group items by store category (Dairy, Produce, etc.).
- [ ] **Price Estimation & Budgeting**: Calculate "Total Estimated Cost" before checkout.
- [ ] **Receipt Scanning (OCR)**: Scan physical receipts to add items or verify prices.

## 🤝 Social & Collaboration (Phase 2)
- [ ] **"In-Store" Live Mode**: Visual indicators when multiple users are shopping together.
- [ ] **Quick Reactions & Comments**: In-line emoji reactions and per-item comments.
- [ ] **Meal Plan Templates**: Tap-to-add ingredient bundles for common recipes.

## 🪙 Economy & Gamification (Phase 3)
- [ ] **Premium List Themes**: Spend coins to unlock custom skins and icons.
- [ ] **Advanced Spending Analytics**: Dashboard showing price trends and category splits.
- [ ] **Smart Restock Suggestions**: Predictive alerts for items you buy frequently.

## 📱 Native Enhancements (Capacitor)
- [ ] **Location-Based Reminders**: Ping users when they are near a grocery store.
- [x] **Loyalty Card Wallet**: Store and display barcodes for membership cards.
- [ ] **Native App Shortcuts**: "Quick Add" from the home screen icon.

## 🏪 Store Ecosystem (Phase 4)
- [ ] **Store Pages**: Verified merchants can create their own page and list products in stock.
- [ ] **Inventory & Sales Tracking**: Stores can update availability and set start/ending dates for sales.
- [ ] **Product "Likes"**: Users can mark products as favorites to find them easily during their next visit.
- [ ] **Smart Store Discovery**:
    - **Geolocation Suggestions**: Use Capacitor Geolocation to suggest neighboring stores as users move.
    - **Map Data Integration**: Query open-source map data (like OpenStreetMap) to identify nearby stores and match them against the items on your shopping lists. Add a map view to show nearby stores. If the store is not listed in the app, send the information to the backend to be added to the app, inform the admin. On the admin side, allow the admin to review the map location, leave a automatically generated comment on the store's google maps page suggesting them to add the store to the app.


- [x] **User Preference Seeding**: Implement an initial category selection step to learn about user's interests and provide more relevant store/product suggestions. Include Halaal as a category to choose when learning user preferences.