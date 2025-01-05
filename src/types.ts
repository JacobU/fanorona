import Cell from './Cell.js';

// PieceType enum
export enum PieceType {
    EMPTY = 0,
    WHITE = 1,
    BLACK = 2,
}

export enum Winner {
    NONE = 0,
    WHITE = 1,
    BLACK = 2,
}

export enum Turn {
    WHITE = 0,
    BLACK = 1,
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

export interface TreeNode<T> {
    value: T;
    children: TreeNode<T>[];
    isComplete: boolean; // Tracks if the node represents a complete move
    attackType: AttackType;
}

export function addChild<T>(parent: TreeNode<T>, child: TreeNode<T>): void {
    parent.children.push(child);
}

export function getAllPaths<T>(node: TreeNode<T>): T[][] {
    const paths: T[][] = [];

    function traverse(currentNode: TreeNode<T>, currentPath: T[]): void {
        // Add the current node's value to the path
        currentPath.push(currentNode.value);

        // If the node has no children, it’s a leaf node—record the path
        if (currentNode.children.length === 0) {
            paths.push([...currentPath]); // Push a copy of the current path
        } else {
            // Traverse all children
            for (const child of currentNode.children) {
                traverse(child, currentPath);
            }
        }

        // Backtrack by removing the last node (clean up the path for siblings)
        currentPath.pop();
    }

    traverse(node, []);
    return paths;
}

export interface BoardState {
    positions: number[],
    numWhitePieces: number,
    numBlackPieces: number,
    turn: Turn,
    turnMoveIndexes: number[],
    currentlyMovingPiece: number | null,
}

export interface CompleteMove {
    initialMovingPieceIndex: number,
    moveIndexes: number[],
    moveTypes: AttackType[],
}

export function getOppositeDirection(direction: Direction): Direction {
    // There are 8 possible directions
    return (7 - direction);
}

export function getOppositePieceType(pieceType: PieceType): PieceType {
    if (pieceType === PieceType.EMPTY) {
        return PieceType.EMPTY;
    }
    return pieceType === PieceType.BLACK ? PieceType.WHITE : PieceType.BLACK;
}

export interface Connection {
    index: number,
    direction: Direction,
}

export interface Neighbour {
    direction: Direction,
    cell: Cell,
}

/**
 * index: the index of the cell which the piece would end up at.
 * direction: the direction the move would make the piece travel.
 */
export interface Move {
    index: number,
    direction: Direction,
    attackType: AttackType,
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