"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const jsonpad_sdk_1 = __importDefault(require("@basementuniverse/jsonpad-sdk"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
require("express-async-errors");
const constants = __importStar(require("./constants"));
const controllers = __importStar(require("./controllers"));
const error_1 = __importDefault(require("./error"));
class Server {
    constructor(options) {
        this.server = null;
        this.options = Object.assign({}, Server.defaultOptions, options !== null && options !== void 0 ? options : {});
        // Initialise the API
        this.api = (0, express_1.default)();
        this.api.use(express_1.default.json());
        this.api.use((0, cors_1.default)({
            origin: '*',
            optionsSuccessStatus: 204,
        }));
        // API routes
        this.api.post('/start-game', async (request, response) => {
            await controllers.startGame(this, request, response);
        });
        this.api.post('/join-game/:gameId', async (request, response) => {
            await controllers.joinGame(this, request, response);
        });
        this.api.post('/move/:gameId', async (request, response) => {
            await controllers.move(this, request, response);
        });
        // Error handling
        this.api.use((error, request, response, next) => {
            var _a;
            console.error(error);
            if (error instanceof error_1.default) {
                return response.status((_a = error.status) !== null && _a !== void 0 ? _a : 500).send(error.message);
            }
            return response.status(500).send('Unknown error');
        });
        // Initialise jsonpad SDK
        this.jsonpad = new jsonpad_sdk_1.default(this.options.jsonpadServerToken);
    }
    /**
     * Start the server
     */
    start(port) {
        const actualPort = port || constants.DEFAULT_PORT;
        this.server = this.api.listen(actualPort, () => {
            console.log(`Server listening on port ${actualPort}`);
        });
    }
    /**
     * Stop the server
     */
    stop() {
        if (this.server) {
            this.server.close();
            console.log('Server stopped');
        }
    }
}
exports.Server = Server;
Server.defaultOptions = {
    jsonpadServerToken: '',
    jsonpadGamesList: '',
    jsonpadPlayersList: null,
    minPlayers: 2,
    maxPlayers: 2,
    gameSchema: {
        type: 'object',
    },
    playerSchema: {
        type: 'object',
    },
    moveSchema: {
        type: 'object',
    },
    hooks: {},
};
//# sourceMappingURL=server.js.map