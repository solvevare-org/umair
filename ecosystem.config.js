module.exports = {
  apps : [{
    name   : "umair-backend",
    script : "server.js",
    cwd    : "./backend",
    watch  : false,
    instances: 1,
    exec_mode: "fork",
    env    : {
      "NODE_ENV": "production",
      "PORT": 3004
    },
    error_file: "../logs/backend-error.log",
    out_file: "../logs/backend-out.log",
    log_file: "../logs/backend-combined.log",
    time: true
  }]
}