# SmartApp Studio

> 🎯 Submission for the **Hedera AI Agents Hackathon 2025**  
> 🏆 Tracks:  
> - **Best Use of HCS-10**  
> - **Best Use of AgentKit / MCP** *(implements a custom AI agent using HCS-10)*

## 📌 Project Overview

SmartApp Studio is an AI-assisted platform that revolutionizes the development of decentralized applications on the Hedera network. Our platform enables developers to create sophisticated SmartApps without writing or deploying smart contracts. All logic runs off-chain via validator files executed by decentralized SmartNodes.

**Powered by:**  
🧠 OpenAI API | 🟣 HbarSuite SmartNodes | 🧩 HCS-10 Protocol | 🪙 HTS (HSUITE, NFT licenses) | 📡 Mirror Node | 🔐 WalletConnect 2.0

**Problem Solved:**
- Traditional blockchain development requires specialized knowledge in smart contract programming
- The entry barrier for decentralized application development is prohibitively high
- Developing for Hedera requires understanding multiple technologies (HTS, HCS, Mirror Node)

**Why It Matters:**
SmartApp Studio democratizes blockchain development by using generative AI and the HCS-10 protocol to guide developers through the process of creating decentralized applications, automatically generating project structures, NFT schemas, and functional base code.

## 📌 Step-by-Step Video Walkthrough

### 1️⃣ Access SmartApp Studio
- Visit [https://smartapp-studio-sgqp.vercel.app/](https://smartapp-studio-sgqp.vercel.app/)  
- The landing page introduces the platform's core concepts and benefits  
- Click **"Get Started"** to begin

---

### 2️⃣ Connect Your Wallet
- Click the **"Connect Wallet"** button (bottom-right corner)  
- Choose your preferred wallet (e.g., HashPack, KabilaWallet)  
- Approve the connection request in your wallet  
- Once connected, your wallet address appears in the navigation bar

---

### 3️⃣ Mint Your NFT License
- Navigate to the **"Account"** page  
- Begin the **Get License** flow  
- Approve the token association transaction  
- Receive both your **License NFT** and **test HSuite tokens**  
- This NFT acts as your identity and access credential in the ecosystem

---

### 4️⃣ Subscribe to a Plan
- Go to the **"Projects"** page  
- Open the subscription modal and click **"Subscribe"**  
- Confirm the HSuite token payment in your wallet  
- Your subscription status updates immediately, unlocking access to the AI assistant

---

### 5️⃣ Create Your First Project
- In the **"Projects"** section, click **"New Project"**  
- Enter a name for your SmartApp  
- Click **"Create"** — your project is initialized and saved on-chain via HCS

---

### 6️⃣ Interact with the AI Assistant
- Open your newly created project  
- Describe your app idea (e.g., *"a token-gated community platform"*)  
- The AI assistant will ask clarifying questions and generate SmartNode-compatible validator logic  
- Review the config and logic generated for your SmartApp  
- All interactions are logged on the Hedera network using the **HCS-10 protocol**

## 📌 How Hedera is Used

### Hedera Token Service (HTS)
- **License NFT Minting**
  - Creates unique NFT licenses that grant access to SmartApp Studio
  - Stores topic IDs as NFT metadata to link licenses with conversation history
  - File: `backend/src/services/licenseService.ts`

- **Payment System**
  - Uses HSUITE tokens for monetization
  - Token transfers for access to premium features
  - File: `frontend/components/MessagePaymentModal.tsx`

### Hedera Consensus Service (HCS) & HCS-10
- **Decentralized Storage & Communication**
  - Records all conversations in HCS topics
  - Implements HCS-10 protocol for AI agent communication
  - File: `backend/src/services/chatService.ts`

- **Topic Management**
  - Creates separate topics for each project
  - Allows users to create and manage multiple projects
  - File: `backend/src/services/projectService.ts`

### Mirror Node
- **Historical Data Retrieval**
  - Fetches message history from HCS topics
  - Verifies token balances and information
  - File: `backend/src/services/hederaService.ts`

- **Account Validation**
  - Retrieves account information and NFTs
  - Validates licenses and subscriptions
  - File: `backend/src/services/subscriptionService.ts`

## 📌 HCS-10 Usage

SmartApp Studio implements the HCS-10 protocol for AI agent communication on Hedera Consensus Service:

- **Message Structure**
  - All messages follow standardized format with type identifiers:
    - `CHAT_TOPIC`: For AI-user conversations
    - `LICENSE_CREATION`: For creating and tracking licenses
    - `PROJECT_CREATION`: For new project initialization
    - `SUBSCRIPTION_CREATED`: For subscription management

- **Topic Organization**
  - **License Topics**: Main topics associated with NFT licenses
  - **Project Topics**: Secondary topics for each user project
  - **Chunked Messages**: Support for large responses split into multiple chunks

- **Message Flow**
  1. User sends prompt to AI Assistant
  2. Backend processes request and calls AI service
  3. Response is recorded to appropriate topic using HCS-10 protocol
  4. Frontend retrieves and displays message history from topics

The main implementation can be found in:
- `backend/src/services/chatService.ts`
- `backend/src/services/topicService.ts`

## 📌 What Are SmartNodes?

SmartNodes are off-chain validators developed by HbarSuite.  
They run custom JSON-based validator files that define rules, access control, and signing logic — all without smart contracts.

Every SmartApp generated by this project is powered by a SmartNode validator config.

## 📌 Setup & Build Instructions

### Prerequisites
- Node.js v16+
- Hedera Account (Testnet)
- OpenAI API Key

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
```

Configure the following in your `.env` file:
```
OPENAI_API_KEY=your_key_here
PORT=3001
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.XXXXX
HEDERA_OPERATOR_KEY=302e...
HSUITE_TOKEN_ID=0.0.2203022
LICENSE_TOKEN_ID=0.0.XXXXX
```

Start the backend server:
```bash
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
```

Configure the following in your `.env.local` file:
```
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=walletconnect_project_key
NEXT_PUBLIC_HSUITE_TOKEN_ID=0.0.2203022
NODE_ENV=development
NEXT_PUBLIC_NEW_PROJECT_PRICE=50
NEXT_PUBLIC_MESSAGE_PRICE=10
LICENSE_IMAGE_URL='https://bafybeibhak25l3754uor4onzwqpeuq44wuhgxopi46e434q6quwija6g64.ipfs.w3s.link/ChatGPT%20Image%202%20de%20mai.%20de%202025%2C%2011%5F26%5F14.png'
```

Start the frontend server:
```bash
npm run dev
```

## 📌 Deployment Links


- **Demo Video:** [SmartApp Studio Demo](https://youtu.be/TQXTbXemG0s)
- **Live Application:** [smartapp-studio.vercel.app](https://smartapp-studio-sgqp.vercel.app/)
- **Project PitchDeck** [View Pitch Deck](./SmartApp_Studio_PitchDeck.pdf)
- **License NFT Collection:** [0.0.5892772 (Testnet)](https://hashscan.io/testnet/token/0.0.5892772)
- **License Main Topic:** [0.0.5940162 (Testnet)](https://hashscan.io/testnet/token/0.0.5940162)
- **Project Topic:** [0.0.5940169 (Testnet)](https://hashscan.io/testnet/topic/0.0.5940169)
- 
- **HSUITE Token:** [0.0.2203022 (Testnet)](https://hashscan.io/testnet/token/0.0.2203022)

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---
