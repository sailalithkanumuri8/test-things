#!/bin/bash
# Quick monitoring commands
case "$1" in
    "start")
        node util/dist/monitor-cli.js start
        ;;
    "report")
        node util/dist/monitor-cli.js report
        ;;
    "alerts")
        node util/dist/monitor-cli.js alerts
        ;;
    "crashes")
        node util/dist/monitor-cli.js crashes
        ;;
    "health")
        node util/dist/monitor-cli.js health
        ;;
    "dashboard")
        node util/dist/monitoring-dashboard.js
        ;;
    *)
        echo "Usage: ./monitor.sh [start|report|alerts|crashes|health|dashboard]"
        echo ""
        echo "Commands:"
        echo "  start     - Start continuous monitoring"
        echo "  report    - Generate health report"
        echo "  alerts    - Show active alerts"
        echo "  crashes   - Show recent crashes"
        echo "  health    - Show system health"
        echo "  dashboard - Start web dashboard"
        ;;
esac
