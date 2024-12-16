import { PieceType } from "./types.js";

export class Cell {
    
    #pieceType;

    constructor(pieceType) {
        this.#pieceType = pieceType;
    }

    getPieceType() {
        return this.#pieceType
    }

    isPieceType(pieceType) {
        return pieceType === this.#pieceType;
    }

    getPossibleMoves(neighbours) {
        const possibleMoves = neighbours.filter(neighbour => neighbour.pieceType === PieceType.values.EMPTY);
        return possibleMoves;
    }

    removePiece() {
        this.#pieceType = PieceType.values.EMPTY;
    }
}