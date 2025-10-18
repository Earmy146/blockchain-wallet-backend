#!/bin/bash

# Script tự động tạo cấu trúc thư mục backend
# File: create-structure.sh

echo "🚀 Creating backend structure..."

# Tạo thư mục
mkdir -p src/{constants,config,utils,models,services,middlewares,controllers,api}
mkdir -p logs

# Tạo file rỗng cho constants
touch src/constants/networks.js
touch src/constants/errorMessages.js

# Tạo file rỗng cho config
touch src/config/index.js
touch src/config/db.config.js
touch src/config/blockchain.config.js

# Tạo file rỗng cho utils
touch src/utils/logger.js
touch src/utils/response.js
touch src/utils/validators.js
touch src/utils/errorHandler.js

# Tạo file rỗng cho models
touch src/models/user.model.js
touch src/models/wallet.model.js
touch src/models/transaction.model.js

# Tạo file rỗng cho services
touch src/services/encryption.service.js
touch src/services/blockchain.service.js
touch src/services/wallet.service.js
touch src/services/transaction.service.js

# Tạo file rỗng cho middlewares
touch src/middlewares/auth.middleware.js
touch src/middlewares/validation.middleware.js
touch src/middlewares/rateLimiter.middleware.js

# Tạo file rỗng cho controllers
touch src/controllers/user.controller.js
touch src/controllers/wallet.controller.js
touch src/controllers/transaction.controller.js

# Tạo file rỗng cho routes
touch src/api/user.routes.js
touch src/api/wallet.routes.js
touch src/api/transaction.routes.js
touch src/api/index.js

# Tạo file root nếu chưa có
touch server.js
touch package.json

echo "✅ Structure created successfully!"
echo ""
echo "📂 Created directories:"
find src -type d | sort

echo ""
echo "📄 Created files:"
find src -type f -name "*.js" | sort

echo ""
echo "⚠️  WARNING: All files are empty!"
echo "You need to copy code from artifacts into each file."
