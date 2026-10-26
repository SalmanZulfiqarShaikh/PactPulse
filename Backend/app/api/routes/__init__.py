from Backend.app.api.routes import analysis, auth, chat, contracts

routers = [auth.router, contracts.router, analysis.router, chat.router]
