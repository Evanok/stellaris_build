#!/bin/bash
pm2 stop stellaris-build
echo 'Maintenance mode enabled. nginx will serve /maintenance.html automatically (502 error_page).'
