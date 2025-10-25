#!/usr/bin/env bash
# local_run.sh
# Start the entire KYC/AML brique stack locally

set -eu

echo "=== Starting Molam KYC/AML Brique ==="

cd "$(dirname "$0")/../infra"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
  echo "Error: docker-compose not found. Please install docker-compose."
  exit 1
fi

# Build and start all services
echo "Building and starting services..."
docker-compose up --build -d

echo ""
echo "Services starting... Waiting for health checks..."
sleep 15

# Check service health
echo ""
echo "=== Service Status ==="
docker-compose ps

echo ""
echo "=== MinIO Console ==="
echo "URL: http://localhost:9003"
echo "Username: minioadmin"
echo "Password: minioadmin"
echo "Bucket: molam-kyc (create manually if not exists)"

echo ""
echo "=== KYC API ==="
echo "URL: http://localhost:4201"
echo "Health: http://localhost:4201/health"

echo ""
echo "=== PostgreSQL ==="
echo "Host: localhost:5433"
echo "Database: molam_kyc"
echo "Username: molam"
echo "Password: molam_pass"

echo ""
echo "=== Next Steps ==="
echo "1. Create MinIO bucket 'molam-kyc' via console (http://localhost:9003)"
echo "2. Run integration test: cd ../ci && ./test_local_kyc_flow.sh"

echo ""
echo "To view logs: docker-compose logs -f [service-name]"
echo "Available services: kyc-api, kyc-processor, postgres, minio"
echo ""
echo "To stop: docker-compose down"
echo "To stop and remove volumes: docker-compose down -v"
