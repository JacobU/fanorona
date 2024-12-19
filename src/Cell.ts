import { PieceType, Move, CellType, Neighbour, Connection } from "./types.ts";


export default class Cell {
    // Private class field for cell and piece types
    #index: number;
    #cellType: CellType;
    #pieceType: PieceType;
    #connections: Connection[];

    constructor(index: number, cellType: CellType, pieceType: PieceType, connections: Connection[]) {
        this.#index = index;
        this.#cellType = cellType;
        this.#pieceType = pieceType;
        this.#connections = connections;
    }

    public getIndex(): number {
        return this.#index;
    }
    
    // Getter for the piece type
    public getPieceType(): PieceType {
        return this.#pieceType;
    }

    public getCellType(): CellType {
        return this.#cellType;
    }

    public getCellConnections(): Connection[] {
        return this.#connections;
    }

    // Setter for the piece type
    public setPieceType(pieceType: PieceType): void {
        this.#pieceType = pieceType;
    }

    // Checks if the current piece type matches the given type
    public isPieceType(pieceType: PieceType): boolean {
        return pieceType === this.#pieceType;
    }

    /**
     * @param neighbours The neighbours of the cell we want the possible moves from.
     * @returns The neighbouring cells that are empty, as Moves.
     */
    public getPossibleMoves(neighbours: Neighbour[]): Move[] {
        return neighbours
            .filter((neighbour) => neighbour.pieceType === PieceType.EMPTY)
            .map(neighbour => ({index: neighbour.index, direction: neighbour.direction}));
    }

    // Removes a piece by setting its type to EMPTY
    public removePiece(): void {
        this.#pieceType = PieceType.EMPTY;
    }
}
