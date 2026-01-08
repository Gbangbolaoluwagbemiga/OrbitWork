# OrbitWork 🔐

<div align="center">

**A decentralized freelancer marketplace built on Casper that provides secure, trustless escrow services for freelance work agreements.**

[![Casper](https://img.shields.io/badge/Casper-Network-FF0000?style=flat-square&logo=casper)](https://casper.network)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Rust](https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)

</div>

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Smart Contract Details](#smart-contract-details)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

OrbitWork is a blockchain-powered freelancer marketplace that revolutionizes how clients and freelancers collaborate. Built on the Casper network using Rust smart contracts, OrbitWork ensures secure payments, transparent milestone tracking, and fair dispute resolution—all without requiring trust between parties.

### Why OrbitWork?

- **🔒 Trustless Escrow**: Funds are locked in smart contracts until work is approved
- **⚡ Fast & Low-Cost**: Leverages Casper's fast, low-fee network
- **🌍 Global Access**: Works with native CSPR and whitelisted tokens
- **⚖️ Fair Disputes**: Multi-arbiter system ensures fair conflict resolution
- **📊 On-Chain Reputation**: Build trust through verifiable, on-chain reputation scores

---

## ✨ Features

### Core Features

- 🔐 **Smart Contract Escrow**: Funds are secured in blockchain escrow until milestones are approved
- 📋 **Milestone-Based Payments**: Break projects into milestones with automatic payment releases
- 💼 **Job Marketplace**: Post open jobs or create direct contracts with known freelancers
- 👥 **Application System**: Freelancers can apply to open jobs with cover letters and timelines
- ⚖️ **Dispute Resolution**: Multi-arbiter system with admin oversight for fair conflict resolution
  - **Resolution Display**: Both clients and freelancers can see who won a dispute on their job cards
  - **Transparent Outcomes**: Clear indication of resolution results (freelancer payment or client refund)
- 💰 **Refund Protection**: Automatic refunds after deadlines with emergency mechanisms
- ⭐ **Reputation & Rating System**: Build trust through on-chain reputation scores
  - **Client Ratings**: Clients can rate freelancers after project completion (1-5 stars with reviews)
  - **Badge Tiers**: Freelancers earn badges (Beginner, Intermediate, Advanced, Expert) based on completed projects
  - **Average Ratings**: Display average ratings and review counts for freelancers
- 💎 **Multi-Token Support**: Use native CSPR or any whitelisted token
- ⏰ **Deadline Management**: Flexible deadlines with extension capabilities
- 🛡️ **Admin Controls**: Platform management with pause/unpause capabilities
- 🔄 **Milestone Resubmission**: Freelancers can resubmit rejected milestones with improvements

### Security Features

- ✅ **Authorization Checks**: All operations require proper authentication
- ✅ **Token Whitelisting**: Only approved tokens can be used
- ✅ **Arbiter Authorization**: Only authorized arbiters can resolve disputes
- ✅ **Platform Fee Management**: Configurable platform fees with dedicated collector
- ✅ **Emergency Refunds**: Automatic refunds after deadline expiration

---

## 🔄 How It Works

### Workflow Overview

OrbitWork operates through a streamlined workflow that ensures security and fairness at every step:

```
1. Job Creation → 2. Application/Selection → 3. Work Start → 4. Milestone Submission → 5. Approval/Dispute → 6. Payment Release
```

### Detailed Flow

#### 1. **Job Creation** 🎯

Clients can create jobs in two ways:

- **Open Job Marketplace**: Create a job without specifying a freelancer. Anyone can apply.
- **Direct Contract**: Create a job directly with a known freelancer address.

**What happens:**

- Client deposits funds (CSPR or whitelisted token) into the escrow contract
- Sets up milestones with amounts and descriptions
- Defines project details (title, description, deadline)

#### 2. **Application & Selection** 🤝

(For Open Marketplace Jobs)

- Freelancers view open jobs and submit applications
- Applications include a cover letter and estimated completion date
- Client reviews applications and selects a freelancer
- **Note**: Selecting a freelancer locks the contract to that specific freelancer

#### 3. **Work & Milestones** 🏗️

- Freelancer starts working on the agreed milestones
- Upon completion of a milestone, the freelancer submits it for approval
- Status updates to "In Progress" or "Reviewing"

#### 4. **Approval & Payment** 💸

- Client reviews the submitted milestone
- **Approval**: If satisfied, client approves the milestone. Funds for that milestone are automatically released to the freelancer.
- **Rejection**: Client can reject the milestone with feedback. Freelancer must revise and resubmit.

#### 5. **Dispute Resolution** ⚖️

If a disagreement occurs (e.g., client refuses to approve valid work, or freelancer stops responding):

- Either party can initiate a dispute
- An authorized arbiter reviews the case
- Arbiter decides the outcome:
  - **Release to Freelancer**: Funds go to the freelancer
  - **Refund to Client**: Funds return to the client
- The dispute is recorded on-chain

#### 6. **Completion & Rating** ⭐

- Once all milestones are completed, the job is marked as finished
- Client can rate the freelancer (1-5 stars) and leave a review
- Freelancer's reputation score and badge tier are updated

---

## 🏗️ Architecture

The project consists of two main components:

1.  **Smart Contracts (Casper)**: Written in Rust, handling all logic, state, and funds.
2.  **Frontend (React)**: A modern web interface for interacting with the contracts.

### Smart Contract Modules

- **Escrow Core**: Main contract logic (deposits, releases, state management)
- **Marketplace**: Job posting and application handling
- **Admin**: Platform controls and fee management
- **Dispute Resolution**: Arbiter system and dispute logic
- **Reputation**: Rating and badge system

### Frontend

- **Framework**: React + Vite
- **Wallet Connection**: Casper Wallet / CasperDash
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Query + Context API

---

## 🛠️ Tech Stack

- **Blockchain**: Casper Network
- **Smart Contracts**: Rust
- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Wallet**: Casper Wallet
- **Testing**: Casper Test Framework

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Casper Client](https://docs.casper.network/developers/cli/installing-casper-client/)
- [Casper Wallet](https://www.casperwallet.io/) extension

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/orbitwork.git
    cd orbitwork
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```
