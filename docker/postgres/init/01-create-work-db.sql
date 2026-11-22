-- Work service has its own database (database per service). Runs only when the Postgres volume is first created;
-- on an existing volume run:  docker compose exec postgres psql -U projecty -d platform -c "CREATE DATABASE work"
CREATE DATABASE work;
