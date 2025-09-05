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
  }, {
    name   : "umair-frontend",
    script : "openai.js",
    cwd    : "./frontend",
    watch  : false,
    instances: 1,
    exec_mode: "fork",
    env    : {
      "NODE_ENV": "production",
      "PORT": 3002
    },
    error_file: "../logs/frontend-error.log",
    out_file: "../logs/frontend-out.log",
    log_file: "../logs/frontend-combined.log",
    time: true
  }]
}