# Xcode IAP Configuration Instructions

Follow these steps to enable In-App Purchases in your Xcode project and configure the StoreKit testing environment.

## Step 1: Add In-App Purchase Capability

1. **Open the project in Xcode:**
   ```bash
   cd /Users/harjit/Documents/SafetyCamAI/ios
   open safetycamai.xcworkspace
   ```
   > ⚠️ Make sure to open the `.xcworkspace` file, NOT the `.xcodeproj` file

2. **Select your project target:**
   - In the left sidebar, click on the blue project icon labeled "safetycamai"
   - In the main panel, select the "safetycamai" target (under TARGETS)

3. **Go to Signing & Capabilities tab:**
   - Click the "Signing & Capabilities" tab at the top

4. **Add In-App Purchase capability:**
   - Click the "+ Capability" button
   - Search for "In-App Purchase"
   - Double-click to add it

## Step 2: Configure StoreKit Configuration File

1. **Select the StoreKit configuration file:**
   - In Xcode menu bar, go to: **Editor > Select StoreKit Configuration File**
   - Navigate to and select: `ios/Configuration.storekit`
   - Click "Choose"

2. **Verify configuration is active:**
   - You should see a checkmark next to `Configuration.storekit` in the Editor menu
   - This enables local product testing without connecting to App Store Connect

## Step 3: Clean and Rebuild

1. **Clean build folder:**
   - In Xcode: **Product > Clean Build Folder** (or press ⇧⌘K)

2. **Rebuild the project:**
   ```bash
   cd /Users/harjit/Documents/SafetyCamAI
   npm run ios
   ```

## Step 4: Verify Setup

After running the app, check the console for:

```
📦 Available Products: [{productId: "com.safetycamai.monthly", ...}]
```

If you see an empty array `[]`, ensure:
- StoreKit configuration is properly selected in Xcode
- The product ID matches exactly: `com.safetycamai.monthly`
- You've cleaned and rebuilt the project

## Sandbox Testing (On Real Device)

### Prerequisites
1. **Create a sandbox tester account** in App Store Connect:
   - Go to: Users and Access > Sandbox Testers
   - Create a test account (use a different email from your Apple ID)

2. **Sign out of App Store on device:**
   - Settings > [Your Name] > Media & Purchases > Sign Out
   - Do NOT sign in with sandbox account yet

### Testing Steps

1. **Run app on device:**
   ```bash
   npm run ios -- --device
   ```

2. **Navigate to SubscriptionScreen** in the app

3. **Tap "Subscribe Now":**
   - iOS will prompt for App Store sign-in
   - Sign in with your sandbox tester account
   - Confirm the purchase (it's free in sandbox)

4. **Check console output:**
   ```
   🛒 Starting real IAP purchase flow...
   ✅ Purchase request sent to Apple
   🧾 Real Receipt Length: 1234 (should be > 1000)
   📤 Sending receipt to backend for verification...
   ✅ Payment verified successfully!
   ```

## Troubleshooting

### "No products found"
- Verify StoreKit configuration is selected in Xcode
- Clean build folder and rebuild
- Check product ID spelling in `itemSkus` array

### "Invalid Product ID" error
- Ensure product exists in App Store Connect
- Product must be in "Ready to Submit" state
- Bundle ID in Xcode must match App Store Connect

### Backend verification fails
- Check that backend is running and accessible
- Verify GraphQL endpoint in `config.js`
- Check sandbox receipt format is supported by backend

### Purchase succeeds but backend not called
- Check that `USE_MOCK_FOR_UI_TESTING = false` in SubscriptionScreen.js
- Verify purchaseUpdatedListener is registered (check useEffect)
- Look for errors in backend logs
