import { PieceType, Direction, CellType, StrongIntersectionMoveMap, WeakIntersectionMoveMap } from "./types.ts";

// Define the structure for a neighbor
interface Neighbour {
    pieceType: PieceType; // Use PieceType enum for strong typing
    direction: Direction; // Use Direction enum for clarity
}

export class Cell {
    // Private class field for cell and piece types
    #cellType: CellType;
    #pieceType: PieceType;

    constructor(cellType: CellType, pieceType: PieceType) {
        this.#cellType = cellType;
        this.#pieceType = pieceType;
    }

    // Getter for the piece type
    public getPieceType(): PieceType {
        return this.#pieceType;
    }

    public getCellType(): CellType {
        return this.#cellType;
    }

    public getCellMoveMap(): Map<Direction, { deltaRow: number; deltaCol: number }> {
        return this.#cellType === CellType.STRONG ? StrongIntersectionMoveMap : WeakIntersectionMoveMap;
    }

    // Setter for the piece type
    public setPieceType(pieceType: PieceType): void {
        this.#pieceType = pieceType;
    }

    // Checks if the current piece type matches the given type
    public isPieceType(pieceType: PieceType): boolean {
        return pieceType === this.#pieceType;
    }

    // Gets possible moves by filtering neighbors with EMPTY cells
    public getPossibleMoves(neighbours: Neighbour[]): Direction[] {
        return neighbours
            .filter((neighbour) => neighbour.pieceType === PieceType.EMPTY)
            .map(neighbour => neighbour.direction);
    }

    // Removes a piece by setting its type to EMPTY
    public removePiece(): void {
        this.#pieceType = PieceType.EMPTY;
    }
}
