#!/usr/bin/env bash
# local_run.sh
# Start the entire audit brique stack locally

set -eu

echo "=== Starting Molam Audit Brique ==="

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
echo "URL: http://localhost:9001"
echo "Username: minioadmin"
echo "Password: minioadmin"

echo ""
echo "=== OpenSearch ==="
echo "URL: http://localhost:9200"

echo ""
echo "=== Verifier API ==="
echo "URL: http://localhost:4100"
echo "Health: http://localhost:4100/health"

echo ""
echo "=== PostgreSQL ==="
echo "Host: localhost:5432"
echo "Database: molam_audit"
echo "Username: molam"
echo "Password: molam_pass"

echo ""
echo "=== Kafka ==="
echo "Brokers: localhost:9092"
echo "Topic: molam.audit.events"

echo ""
echo "To view logs: docker-compose logs -f [service-name]"
echo "To stop: docker-compose down"
echo "To stop and remove volumes: docker-compose down -v"
