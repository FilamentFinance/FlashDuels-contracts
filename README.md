# FlashDuels

FlashDuels is a decentralized binary option/prediction market platform that allows users to create, own, trade and participate in real-time price prediction duels. The platform combines blockchain technology with traditional financial markets to create an engaging and transparent trading experience.

<img width="1414" alt="image" src="https://github.com/user-attachments/assets/f6029859-35d5-4d5f-91fc-2cd015f3817e" />

## Project Overview

FlashDuels consists of several interconnected services that work together to provide a seamless binary option/prediction market experience:

### Core Components

1. **Frontend (Port 3000)**

   - Next.js application providing the main user interface
   - Real-time price updates and duel participation
   - Wallet integration for blockchain interactions
   - Responsive design for both desktop and mobile users

2. **Backend (Port 3004)**

   - Express.js API server handling core business logic
   - User authentication and session management
   - Database operations and data persistence
   - Integration with blockchain networks

3. **Timer Logic (Port 3001)**

   - Manages the timing of prediction rounds
   - Handles round transitions and state management
   - WebSocket-based real-time updates
   - Ensures fair and synchronized duel periods

4. **Invite System (Port 6010)**

   - Manages user invitations and access control
   - Prisma-based database for user management
   - Invitation code generation and validation
   - User onboarding flow

5. **Admin Dashboard (Port 3002)**

   - Administrative interface for platform management
   - User management and monitoring
   - System statistics and analytics
   - Platform configuration and settings

6. **Pricing Services**

   - **Coinduels Pricing (Port 8081)**

     - Python service for Coinduels market pricing
     - Real-time price calculations
     - Market data integration

   - **Flashduels Pricing (Port 5001)**
     - Python service for Flashduels market pricing
     - Price feed management
     - Market state calculations

### Key Features

- Real-time price predictions
- Decentralized trading experience
- Fair and transparent duel system
- Secure user authentication
- Real-time updates and notifications
- Mobile-responsive design
- Admin controls and monitoring
- Invite-only access system

### Technology Stack

- **Frontend**: Next.js, React, TailwindCSS, RainbowKit, Alchemy Account Kit (Smart Account)
- **Backend**: Express.js, MongoDB, JWT
- **Real-time**: WebSocket
- **Database**: MongoDB, Prisma ORM
- **Blockchain**: Base, Sei, or Chain-abstracted app, Soldiity (Programming Language)
- **Tools**: Hardhat, Goldsky (Subgrph/Indexer)
- **Package Manager**: npm, pnpm, yarn

This monorepo contains all the services for the FlashDuels ecosystem, managed using pnpm workspaces.

## Services and Ports

| Service            | Port | Description                                     |
| ------------------ | ---- | ----------------------------------------------- |
| Frontend           | 3000 | Next.js application for the main user interface |
| Backend            | 3004 | Express.js API server                           |
| Timer Logic        | 3001 | Timer service for managing game rounds          |
| Invite System      | 6010 | Invite-only system with Prisma database         |
| Admin Dashboard    | 3002 | Next.js application for admin interface         |
| Coinduels Pricing  | 8081 | Python service for Coinduels pricing            |
| Flashduels Pricing | 5001 | Python service for Flashduels pricing           |

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Python 3.x (for pricing services)
- Virtual environment for Python services

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Set up Python virtual environment for pricing services:

```bash
# Navigate to pricing-engine directory
cd packages/pricing-engine

# Remove existing virtualenv if any
rm -rf virtualenv

# Create a new virtual environment using system Python
python3 -m venv virtualenv

# Activate the virtual environment
source virtualenv/bin/activate

# Your prompt should now show (virtualenv) at the beginning
# Verify you're in the virtual environment (should show path to virtualenv's python)
which python3
# Should show something like: /Users/your-username/path/to/flashduels-app/packages/pricing-engine/virtualenv/bin/python3

# Install requirements (now safe to install as we're in virtualenv)
pip3 install -r requirements.txt

# Deactivate virtual environment when done
deactivate

# Return to root directory
cd ../..
```

If you encounter any issues or conflicts with Homebrew-installed Python3, follow these steps before setting up the virtual environment:

```bash
# Uninstall Python3 and pip3 from Homebrew (if any)
brew uninstall python3
brew uninstall pip3

# Remove Python framework files
sudo rm -rf /opt/homebrew/opt/python@3.13
sudo rm -rf /opt/homebrew/Frameworks/Python.framework

# Remove pip configuration files
rm -rf ~/.pip
rm -rf ~/.config/pip
rm -rf /opt/homebrew/share/pip
rm -rf /Library/Application\ Support/pip

# Clean up Homebrew
brew cleanup

# Verify Python3 is now using system version
which python3
```

3. Update .env files in respective services:

```bash
# Frontend
cd packages/frontend
cp .env.example .env
# Update all variables in .env file

# Backend
cd ../backend
cp .env.example .env
# Update all variables in .env file

# Timer Logic
cd ../timer-logic
cp .env.example .env
# Update all variables in .env file

# Invite System
cd ../invite-system
cp .env.example .env
# Update all variables in .env file

# Admin Dashboard
cd ../admin-dashboard
cp .env.example .env
# Update all variables in .env file

# Pricing Engine
cd ../pricing-engine
cp .env.example .env
# Update all variables in .env file
cd ../..
```

4. Start services:

Option 1: Start all services at once (recommended if all dependencies are installed successfully):

```bash
pnpm dev:all
```

Option 2: Start services individually (if you need to debug or run specific services):

```bash
# Start frontend (Next.js)
pnpm frontend # Port 3000

# Start backend (Express)
pnpm backend # Port 3004

# Start timer service
pnpm timer-logic # Port 3001

# Start invite system (with Prisma)
pnpm invite-system # Port 6010

# Start admin dashboard
pnpm admin-dashboard # Port 3002

# Start pricing services
pnpm coinduels-pricing  # Port 8081
pnpm flashduels-pricing # Port 5001
```

## Development

### Frontend (Next.js)

- Located in `packages/frontend`
- Uses Next.js 14+ with App Router
- TailwindCSS for styling
- RainbowKit for wallet integration

### Backend (Express)

- Located in `packages/backend`
- Express.js server
- MongoDB database
- JWT authentication

### Timer Logic

- Located in `packages/timer-logic`
- Manages game rounds and timing
- WebSocket communication

### Invite System

- Located in `packages/invite-system`
- Prisma ORM for database
- Express.js server
- Requires `prisma generate` before running

### Admin Dashboard

- Located in `packages/admin-dashboard`
- Next.js application
- Admin interface for managing the platform

### Pricing Services

- Located in `packages/pricing-engine`
- Python-based services
- Requires virtual environment
- Two separate services:
  - Coinduels pricing (Port 8081)
  - Flashduels pricing (Port 5001)

## Troubleshooting

### Port Conflicts

If you encounter port conflicts, you can kill the process using:

```bash
# For port 8081 (Coinduels pricing)
lsof -i :8081 | grep LISTEN | awk '{print $2}' | xargs kill -9

# For port 5001 (Flashduels pricing)
lsof -i :5001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Prisma Issues

If you encounter Prisma-related issues:

```bash
# Regenerate Prisma client
pnpm preinvite-system
pnpm backend-prisma
```

## License

GNU General Public License
