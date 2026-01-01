#!/bin/bash

# Integration Test Script
# Tests backend-frontend connection

echo "🧪 Backend-Frontend Integration Test"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1. Checking backend server..."
if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running on port 3000${NC}"
    BACKEND_RUNNING=true
else
    echo -e "${YELLOW}⚠️  Backend is not running. Start it with: cd backend && npm run dev${NC}"
    BACKEND_RUNNING=false
fi

# Check if frontend is running
echo ""
echo "2. Checking frontend server..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running on port 5173${NC}"
    FRONTEND_RUNNING=true
else
    echo -e "${YELLOW}⚠️  Frontend is not running. Start it with: cd frontend && npm run dev${NC}"
    FRONTEND_RUNNING=false
fi

# Test backend health endpoint
echo ""
echo "3. Testing backend health endpoint..."
if [ "$BACKEND_RUNNING" = true ]; then
    HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/v1/health)
    if echo "$HEALTH_RESPONSE" | grep -q "ok\|OK"; then
        echo -e "${GREEN}✅ Health endpoint working${NC}"
        echo "   Response: $HEALTH_RESPONSE"
    else
        echo -e "${RED}❌ Health endpoint not responding correctly${NC}"
        echo "   Response: $HEALTH_RESPONSE"
    fi
fi

# Test backend API endpoint
echo ""
echo "4. Testing backend API (create session)..."
if [ "$BACKEND_RUNNING" = true ]; then
    SESSION_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/sessions \
        -H "Content-Type: application/json" \
        -d '{}')
    
    if echo "$SESSION_RESPONSE" | grep -q "id"; then
        echo -e "${GREEN}✅ Session creation working${NC}"
        SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        echo "   Session ID: $SESSION_ID"
        
        # Test getting session
        echo ""
        echo "5. Testing get session..."
        GET_SESSION=$(curl -s http://localhost:3000/api/v1/sessions/$SESSION_ID)
        if echo "$GET_SESSION" | grep -q "id"; then
            echo -e "${GREEN}✅ Get session working${NC}"
        else
            echo -e "${RED}❌ Get session failed${NC}"
        fi
    else
        echo -e "${RED}❌ Session creation failed${NC}"
        echo "   Response: $SESSION_RESPONSE"
    fi
fi

# Test CORS
echo ""
echo "6. Testing CORS..."
if [ "$BACKEND_RUNNING" = true ]; then
    CORS_HEADER=$(curl -s -I -X OPTIONS http://localhost:3000/api/v1/sessions \
        -H "Origin: http://localhost:5173" \
        | grep -i "access-control")
    
    if [ -n "$CORS_HEADER" ]; then
        echo -e "${GREEN}✅ CORS headers present${NC}"
        echo "   $CORS_HEADER"
    else
        echo -e "${YELLOW}⚠️  CORS headers not found${NC}"
    fi
fi

# Summary
echo ""
echo "===================================="
echo "Summary:"
if [ "$BACKEND_RUNNING" = true ] && [ "$FRONTEND_RUNNING" = true ]; then
    echo -e "${GREEN}✅ Both servers are running${NC}"
    echo ""
    echo "Open http://localhost:5173 in your browser to test the frontend"
else
    echo -e "${YELLOW}⚠️  One or both servers are not running${NC}"
    echo ""
    echo "To start servers:"
    echo "  Terminal 1: cd backend && npm run dev"
    echo "  Terminal 2: cd frontend && npm run dev"
fi
echo ""

