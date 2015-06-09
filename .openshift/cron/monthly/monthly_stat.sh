#!/bin/bash
## just run generate_last_month_stats.sh, but redirecting output to logfile
$OPENSHIFT_REPO_DIR/scripts/generate_last_month_stats.sh &>> ${OPENSHIFT_LOG_DIR}/cron_monthly_stat.log