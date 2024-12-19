// PieceType enum
export enum PieceType {
    EMPTY = 0,
    WHITE = 1,
    BLACK = 2,
}

export enum CellType {
    STRONG = 0,
    WEAK = 1,
}

// MoveType enum
export enum MoveType {
    APPROACH = 0,
    WITHDRAW = 1,
}

// Direction enum
export enum Direction {
    UPLEFT = 0,
    UP = 1,
    UPRIGHT = 2,
    LEFT = 3,
    RIGHT = 4,
    DOWNLEFT = 5,
    DOWN = 6,
    DOWNRIGHT = 7,
}

export function getOppositeDirection(direction: Direction): Direction {
    // There are 8 possible directions
    return (7 - direction);
}

export function getOppositePieceType(pieceType: PieceType): PieceType {
    return pieceType === PieceType.BLACK ? PieceType.WHITE : PieceType.BLACK;
}

export interface Connection {
    index: number,
    direction: Direction,
}

export interface Neighbour {
    index: number,
    pieceType: PieceType,
    direction: Direction,
}

export interface Move {
    index: number,
    direction: Direction,
}

// AttackType enum
export enum AttackType {
    NONE = 0,
    APPROACH = 1,
    WITHDRAW = 2,
}

// Function to calculate the delta index for a given direction dynamically
export function getDeltaIndex(direction: Direction, cols: number): number {
    switch (direction) {
        case Direction.UPLEFT: return -cols - 1;
        case Direction.UP: return -cols;
        case Direction.UPRIGHT: return -cols + 1;
        case Direction.LEFT: return -1;
        case Direction.RIGHT: return 1;
        case Direction.DOWNLEFT: return cols - 1;
        case Direction.DOWN: return cols;
        case Direction.DOWNRIGHT: return cols + 1;
        default: throw new Error("Invalid direction");
    }
}

export const StrongIntersectionMoveDirections: Direction[] = [
    Direction.UPLEFT,
    Direction.UP,
    Direction.UPRIGHT, 
    Direction.LEFT,
    Direction.RIGHT,
    Direction.DOWNLEFT,
    Direction.DOWN,
    Direction.DOWNRIGHT,
];

export const WeakIntersectionMoveDirections: Direction[] = [
    Direction.UP,
    Direction.LEFT,
    Direction.RIGHT,
    Direction.DOWN,
];