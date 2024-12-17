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

// AttackType enum
export enum AttackType {
    NONE = 0,
    APPROACH = 1,
    WITHDRAW = 2,
}

export const StrongIntersectionMoveMap = new Map<Direction, { deltaRow: number; deltaCol: number }>([
    [Direction.UPLEFT, { deltaRow: -1, deltaCol: -1 }],
    [Direction.UP, { deltaRow: -1, deltaCol: 0 }],
    [Direction.UPRIGHT, { deltaRow: -1, deltaCol: 1 }],
    [Direction.LEFT, { deltaRow: 0, deltaCol: -1 }],
    [Direction.RIGHT, { deltaRow: 0, deltaCol: 1 }],
    [Direction.DOWNLEFT, { deltaRow: 1, deltaCol: -1 }],
    [Direction.DOWN, { deltaRow: 1, deltaCol: 0 }],
    [Direction.DOWNRIGHT, { deltaRow: 1, deltaCol: 1 }],
]);

export const WeakIntersectionMoveMap = new Map<Direction, { deltaRow: number; deltaCol: number }>([
    [Direction.UP, { deltaRow: -1, deltaCol: 0 }],
    [Direction.LEFT, { deltaRow: 0, deltaCol: -1 }],
    [Direction.RIGHT, { deltaRow: 0, deltaCol: 1 }],
    [Direction.DOWN, { deltaRow: 1, deltaCol: 0 }],
]);