class Enum {
    constructor(values) {
        this.values = Object.freeze(values);
    }

    isValid(value) {
        return Object.values(this.values).includes(value);
    }
}

export const PieceType = new Enum({ EMPTY:0, WHITE:1, BLACK:2 }); 

export const MoveType = new Enum({ APPROACH:0, WITHDRAW:1 });

export const Direction = new Enum({ 
    UPLEFT: 0, 
    UP: 1, 
    UPRIGHT: 2, 
    LEFT: 3, 
    RIGHT: 4, 
    DOWNLEFT: 5, 
    DOWN: 6, 
    DOWNRIGHT: 7 });

export const AttackType = new Enum({ NONE: 0, APPROACH: 1, WITHDRAW: 2});

export const DirectionMoveMap = new Map([
    [Direction.values.UPLEFT, { deltaRow: -1, deltaCol: -1 }],
    [Direction.values.UP, { deltaRow: -1, deltaCol: 0 }],
    [Direction.values.UPRIGHT, { deltaRow: -1, deltaCol: 1 }],
    [Direction.values.LEFT, { deltaRow: 0, deltaCol: -1 }],
    [Direction.values.RIGHT, { deltaRow: 0, deltaCol: 1 }],
    [Direction.values.DOWNLEFT, { deltaRow: 1, deltaCol: -1 }],
    [Direction.values.DOWN, { deltaRow: 1, deltaCol: 0 }],
    [Direction.values.DOWNRIGHT, { deltaRow: 1, deltaCol: 1 }],
]);