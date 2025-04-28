# SmartApp Studio

## Overview

SmartApp Studio is an AI-assisted platform that revolutionizes the development of decentralized applications on the Hedera network. Developed during the Hedera Hackathon 2024, our solution enables developers to create sophisticated SmartApps without the need to write traditional smart contracts, using HbarSuite and SmartNodes technologies.

**Problem:** Developing decentralized applications requires specialized knowledge in blockchain and smart contract programming, creating a significant entry barrier.

**Solution:** SmartApp Studio uses generative AI and the HCS-10 protocol to guide developers through the process of creating decentralized applications, automatically generating project structures, NFT schemas, and functional base code.

## 🚀 Demo

[Watch the demonstration (5 min)](https://youtu.be/link-to-your-demo)

### Demo Walkthrough:

1. Hedera wallet connection via WalletConnect
2. Creation of a new SmartApp project
3. Interaction with the AI assistant to describe the desired application
4. Structure and code generation by the assistant
5. Visualization of extracted content (code snippets, links)
6. Demonstration of the HSUITE token payment system
7. Verification of messages stored in HCS topics

## 🔗 Deployment Links

- **Main HCS Topic:** [0.0.XXXXX (Testnet)](https://hashscan.io/testnet/topic/0.0.XXXXX)
- **HSUITE Token:** [0.0.2203022 (Testnet)](https://hashscan.io/testnet/token/0.0.2203022)
- **Live Application:** [smartapp-studio.vercel.app](https://smartapp-studio.vercel.app)

## 🔍 Hedera Innovation and Integration

### Hedera Usage

SmartApp Studio utilizes multiple Hedera services:

1. **HCS (Hedera Consensus Service):**
   - Decentralized storage of conversations in HCS topics
   - Implementation of the HCS-10 protocol for AI agent communication
   - Code: [/backend/src/services/hederaService.ts#L120-L180](https://github.com/yourusername/smartapp-studio/blob/main/backend/src/services/hederaService.ts#L120-L180)

2. **HTS (Hedera Token Service):**
   - Payment system based on HSUITE tokens
   - Token transfers for access to premium features
   - Code: [/frontend/components/MessagePaymentModal.tsx#L50-L120](https://github.com/yourusername/smartapp-studio/blob/main/frontend/components/MessagePaymentModal.tsx#L50-L120)

3. **Mirror Node API:**
   - Retrieval of message history from HCS topics
   - Verification of token balances and information
   - Code: [/backend/src/services/aiService.ts#L78-L134](https://github.com/yourusername/smartapp-studio/blob/main/backend/src/services/aiService.ts#L78-L134)

### HIP-991 and HCS-10 Implementation

Our platform implements HIP-991 (Permissionless revenue-generating Topic Ids) and the HCS-10 protocol (AI Agent Communication on HCS):

1. **HIP-991:**
   - Operation of revenue-generating topics for each project
   - Service monetization via HSUITE token payments
   - Code: [/backend/src/routes/hedera.ts#L200-L260](https://github.com/yourusername/smartapp-studio/blob/main/backend/src/routes/hedera.ts#L200-L260)

2. **HCS-10:**
   - Communication protocol between the AI assistant and users
   - Standardized format for topic messages
   - Support for chunked messages for extensive content
   - Code: [/backend/src/services/aiService.ts#L280-L350](https://github.com/yourusername/smartapp-studio/blob/main/backend/src/services/aiService.ts#L280-L350)

## 🏗️ Architecture

**Frontend:**
- Next.js, React, TypeScript
- Tailwind CSS, Shadcn/ui
- WalletConnect for Hedera authentication

**Backend:**
- Node.js, Express, TypeScript
- OpenAI API integration
- Hedera SDK for network interaction

**Storage:**
- Hedera Consensus Service (HCS)
- HCS-10 Protocol

**Payments:**
- Hedera Token Service (HTS)
- HSUITE Token

## 💻 How to Run Locally

### Prerequisites

- Node.js v16+
- Hedera Account (Testnet)
- OpenAI API Key

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Configure variables in .env file
npm run dev
```

Required environment variables:
```
OPENAI_API_KEY=your_key_here
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.XXXXX
HEDERA_OPERATOR_KEY=302e...
HSUITE_TOKEN_ID=0.0.2203022
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Configure variables in .env.local file
npm run dev
```

Required environment variables:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_HSUITE_TOKEN_ID=0.0.2203022
```

## 🧪 Tests

```bash
# Backend
cd backend
npm run test

# Frontend
cd frontend
npm run test
```

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## Monorepo Structure

This project is organized as a monorepo using npm workspaces to manage multiple packages:

```
smartapp-studio/
├── frontend/   # Next.js frontend application
├── backend/    # Express.js backend API
```

### Development

```bash
# Install all dependencies
npm install

# Run both frontend and backend
npm run dev

# Run only frontend
npm run dev:frontend

# Run only backend
npm run dev:backend
```

---
