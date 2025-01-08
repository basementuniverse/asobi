"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerStatus = exports.GameStatus = exports.GameMode = void 0;
var GameMode;
(function (GameMode) {
    GameMode["TURNS"] = "turns";
    GameMode["ROUNDS"] = "rounds";
    GameMode["FREE"] = "free";
})(GameMode || (exports.GameMode = GameMode = {}));
var GameStatus;
(function (GameStatus) {
    GameStatus["WAITING_TO_START"] = "waiting_to_start";
    GameStatus["STARTED"] = "started";
    GameStatus["FINISHED"] = "finished";
})(GameStatus || (exports.GameStatus = GameStatus = {}));
var PlayerStatus;
(function (PlayerStatus) {
    PlayerStatus["WAITING_FOR_TURN"] = "waiting_for_turn";
    PlayerStatus["TAKING_TURN"] = "taking_turn";
    PlayerStatus["FINISHED"] = "finished";
})(PlayerStatus || (exports.PlayerStatus = PlayerStatus = {}));
//# sourceMappingURL=types.js.map