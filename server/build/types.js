"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerStatus = exports.GameStatus = void 0;
var GameStatus;
(function (GameStatus) {
    GameStatus["WAITING_TO_START"] = "waiting_to_start";
    GameStatus["STARTED"] = "started";
    GameStatus["COMPLETED"] = "completed";
})(GameStatus || (exports.GameStatus = GameStatus = {}));
var PlayerStatus;
(function (PlayerStatus) {
    PlayerStatus["WAITING_FOR_TURN"] = "waiting_for_turn";
    PlayerStatus["TAKING_TURN"] = "taking_turn";
    PlayerStatus["FINISHED"] = "finished";
})(PlayerStatus || (exports.PlayerStatus = PlayerStatus = {}));
//# sourceMappingURL=types.js.map