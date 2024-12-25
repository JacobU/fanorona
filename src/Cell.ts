import { PieceType, CellType, Connection, Direction } from "./types.js";


export default class Cell {
    // Private class field for cell and piece types
    #index: number;
    #cellType: CellType;
    #pieceType: PieceType;
    #connections: Connection[];

    constructor(index: number, cellType: CellType, pieceType: PieceType, rows: number, columns: number) {
        this.#index = index;
        this.#cellType = cellType;
        this.#pieceType = pieceType;
        this.#connections = this.createCellConnections(rows, columns);
    }

    private createCellConnections(rows: number, columns: number): Connection[] {
        let connections: Connection[] = [];
            
        const isTopEdge = this.#index < columns;
        const isLeftEdge = this.#index % columns === 0;
        const isRightEdge = (this.#index + 1) % columns === 0;
        const isBottomEdge = this.#index >= (rows - 1) * columns;
    
        if (this.#cellType === CellType.STRONG) {
            let directionIndex = 0;
            for (let i = -1; i < 2; i++) {
                for (let j = -1; j < 2; j++) {
                    // Skip the current cell itself
                    if (i === 0 && j === 0) continue;
    
                    const direction = Direction.UPLEFT + directionIndex;
                    const newIndex = this.#index + j + i * columns;
    
                    // Skip invalid directions based on edge constraints
                    if ((isTopEdge && direction <= Direction.UPRIGHT) ||  // UP directions
                        (isLeftEdge && (direction === Direction.UPLEFT || direction === Direction.LEFT || direction === Direction.DOWNLEFT)) ||  // LEFT directions
                        (isRightEdge && (direction === Direction.UPRIGHT || direction === Direction.RIGHT || direction === Direction.DOWNRIGHT)) ||  // RIGHT directions
                        (isBottomEdge && direction >= Direction.DOWNLEFT)) {  // DOWN directions
                        directionIndex++;
                        continue;
                    }
    
                    connections.push({ index: newIndex, direction });
                    directionIndex++;
                }
            }
        } else {
            // Handle weak connections with edge constraints
            if (!isTopEdge) {
                connections.push({ index: this.#index - columns, direction: Direction.UP });
            }
            if (!isLeftEdge) {
                connections.push({ index: this.#index - 1, direction: Direction.LEFT });
            }
            if (!isRightEdge) {
                connections.push({ index: this.#index + 1, direction: Direction.RIGHT });
            }
            if (!isBottomEdge) {
                connections.push({ index: this.#index + columns, direction: Direction.DOWN });
            }
        }
        return connections;
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

    // Removes a piece by setting its type to EMPTY
    public removePiece(): void {
        this.#pieceType = PieceType.EMPTY;
    }
}
