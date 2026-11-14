import Cell  from './Cell.js';
import { 
    Winner, 
    PieceType, 
    getDeltaIndex, 
    getOppositePieceType, 
    getOppositeDirection, 
    Direction, 
    Move, 
    AttackType, 
    CellType, 
    Turn, 
    CompleteMove, 
    TreeNode,
    BoardState,
    getDirectionFromDeltaIndex,
} from './types.js';

/**
 * The game is a draw if this many turns in a row (counting both players' turns) pass without a capture.
 */
export const NO_CAPTURE_DRAW_TURNS = 60;

export default class Board {
    private rows: number;
    private columns: number;
    private board: Cell[];
    private numWhitePieces: number;
    private numBlackPieces: number;
    private startingPiecePositions: PieceType[];

    private turnMoveIndexes: number[]; 
    private currentlyMovingPiece: number | null;
    private currentTurn: Turn;
    private attackOrWithdraw: AttackType;
    private turnsWithoutCapture: number;

    constructor(rows: number = 5, columns: number = 9, startingPieces?: string) {
        this.numWhitePieces = 0;
        this.numBlackPieces = 0;
        this.startingPiecePositions = [];
        if (startingPieces) {
            if (rows * columns !== startingPieces.length) {
                throw new Error('The number starting positions does not match the board size.');
            }
            this.rows = rows;
            this.columns = columns;
            
            this.board = this.initializeBoard(startingPieces);
        } else {
            this.rows = rows;
            this.columns = columns;
            this.board = this.initializeBoard();
        }
        this.turnMoveIndexes = [];
        this.currentlyMovingPiece = null;
        this.currentTurn = Turn.WHITE;
        this.attackOrWithdraw = AttackType.NONE;
        this.turnsWithoutCapture = 0;
    }

    // Initialize the board with empty cells
    private initializeBoard(startingPiecePositions: string = '222222222222222222212102121111111111111111111'): Cell[] {
        const board: Cell[] = [];
        for (let i = 0; i < this.rows * this.columns; i++) {
            const pieceType: PieceType = parseInt(startingPiecePositions[i], 10) as PieceType;
            const cellType = i % 2 == 0 ? CellType.STRONG : CellType.WEAK;
            board.push(new Cell(i, cellType, pieceType, this.rows, this.columns));
            this.startingPiecePositions.push(pieceType);
            if (pieceType === PieceType.WHITE) this.numWhitePieces++;
            else if (pieceType === PieceType.BLACK) this.numBlackPieces++;
        }

        // Precompute all the neighbours
        for (const cell of board) {
            const connections = cell.getCellConnections();
            connections.forEach(connection => {
                const neighbourCell = board[connection.index];
                cell.setNeighbour(connection.direction, neighbourCell);
            });
        }
        return board;
    }

    public resetBoardState(boardState: BoardState) {
        this.resetPiecePositions(boardState.positions);
        this.numWhitePieces = boardState.numWhitePieces;
        this.numBlackPieces = boardState.numBlackPieces;
        this.currentTurn = boardState.turn;
        this.turnMoveIndexes = [...boardState.turnMoveIndexes]; 
        this.currentlyMovingPiece = boardState.currentlyMovingPiece;
        this.turnsWithoutCapture = boardState.turnsWithoutCapture;
        this.attackOrWithdraw = AttackType.NONE;
    }

    private resetPiecePositions(positions: number[]) {
        for (let i = 0; i < this.rows * this.columns; i++) {
            this.board[i].setPieceType(positions[i]);
        }
    }

    public reset() {
        this.resetPiecePositions(this.startingPiecePositions);
        this.numWhitePieces = this.startingPiecePositions.filter(piece => piece === PieceType.WHITE).length;
        this.numBlackPieces = this.startingPiecePositions.filter(piece => piece === PieceType.BLACK).length;
        this.turnMoveIndexes = []; 
        this.currentlyMovingPiece = null;
        this.currentTurn = Turn.WHITE;
        this.attackOrWithdraw = AttackType.NONE;
        this.turnsWithoutCapture = 0;
    }

    /**
     * @returns {number[]} the board positions as a list of the pieceTypes in each cell
     */
    public saveBoardPositions(): number[] {
        const boardPositions: number[] = [];
        for (let i = 0; i < this.columns * this.rows; i++) {
            boardPositions.push(this.board[i].getPieceType());
        }
        return boardPositions;
    }

    /**
     * @returns {BoardState} the board state
     */
    public saveBoardState(): BoardState {
        return { 
            positions: this.saveBoardPositions(), 
            numWhitePieces: this.numWhitePieces, 
            numBlackPieces: this.numBlackPieces, 
            turn: this.currentTurn,
            turnMoveIndexes: [...this.turnMoveIndexes],
            currentlyMovingPiece: this.currentlyMovingPiece, 
            turnsWithoutCapture: this.turnsWithoutCapture,
        };
    }


    /**
     * @returns {Winner} the winner of the game, Winner.DRAW if NO_CAPTURE_DRAW_TURNS turns have passed without a capture,
     * or Winner.NONE if the game isn't over yet.
     */
    public getWinner(): Winner {
        if (this.numBlackPieces === 0) {
            return Winner.WHITE;
        }
        if (this.numWhitePieces === 0) {
            return Winner.BLACK;
        }
        if (this.turnsWithoutCapture >= NO_CAPTURE_DRAW_TURNS) {
            return Winner.DRAW;
        }
        return Winner.NONE;
    }

    /**
     * @returns the number of turns in a row (counting both players) that have passed without a capture.
     */
    public getTurnsWithoutCapture(): number {
        return this.turnsWithoutCapture;
    }

    /**
     * @returns the current piece positions as a single string, with EMPTY cells as 0s, 
     * WHITE pieces as 1s and BLACK pieces as 2s.
     */
    public getBoardPositionsAsString(): string {
        return this.board
            .map(cell => {
                switch (cell.getPieceType()) {
                    case PieceType.WHITE:
                        return '1';
                    case PieceType.BLACK:
                        return '2';
                    case PieceType.EMPTY:
                        return '0';
                    default:
                        return '.';
                }
            })
            .join('');
    }

    public getBoardPiecePositions(): number[] {
        return this.board.map(cell => cell.getPieceType());
    }

    public getPieceTypeAtIndex(index: number): PieceType {
        return this.board[index].getPieceType();
    }

    /**
     * If there are any pieces that can attack, one of these pieces must attack, so only these will be returned. 
     * Otherwise, any pieces which have empty neighbours can be moved, so they will be returned.
     * @param pieceType whose turn it is, either PieceType.BLACK or PieceType.WHITE.
     * @returns a list of the pieces that the current player can move.
     */
    public getPiecesThatPlayerCanMove(pieceType: PieceType): number[] {
        if (pieceType === PieceType.EMPTY) {
            throw new Error('Empty pieces cannot move');
        }
        // Early return for if we are already moving a piece, since only this piece can be moved.
        if (this.currentlyMovingPiece !== null) {
            return [this.currentlyMovingPiece];
        }

        const attackingPieces: number[] = [];
        const moveablePieces: number[] = [];

        for (const cell of this.board) {
            if (cell.isPieceType(pieceType)) {
                const index = cell.getIndex();
                if (this.canPieceAttack(index)) attackingPieces.push(index);
                if (this.doesPieceHaveEmptyNeighbours(index)) moveablePieces.push(index);
            }
        }

        return attackingPieces.length > 0 ? attackingPieces : moveablePieces;
    }

    public getBoardsNumberOfColumns(): number {
        return this.columns;
    }

    public getBoardsNumberOfRows(): number {
        return this.rows;
    }

    /**
     * Checks whether a move (with index and direction) will cause the players piece to both approach and 
     * withdraw from an opponent piece.
     * @param {number} index the index of the piece to move. 
     * @param {Direction} direction the direction of the piece to move.
     * @returns {boolean} whether the move will cause the piece to both approach and withdraw from opponent pieces.
     */
    public willMoveAttackAndWithdraw(index: number, direction: Direction): boolean {
        const pieceType: PieceType = this.board[index].getPieceType();
        return this.willMoveWithdraw(index, pieceType, direction) && this.willMoveApproach(index, pieceType, direction);
    }

    public setAttackOrWithdraw(attackType: AttackType): void {
        this.attackOrWithdraw = attackType;
    }

    /**
     * Note: willMoveAttackAndWithdraw should be called as a precondition to calling this
     * Perform a single move (which may be just one of several in a turn). We should update the index the piece 
     * has moved, calculate whether the move will APPROACH or WITHDRAW from an opponents piece, 
     * remove the pieces if needed, make the move, and then determine if another move can be made.
     * If the movedPiece is set, then we can only get possible moves from that piece.
     * @param {number} index the index of the piece to move. 
     * @param {Direction} direction the direction of the piece to move.
     * @returns {boolean} whether the player can move again.
     */
    public performMove(index: number, direction: Direction, virtualMove: boolean = false): boolean {
        if (!(direction in Direction)) {
            throw new Error('Invalid direction when trying to move a piece.');
        }
        const pieceType: PieceType = this.board[index].getPieceType();
        if (pieceType === PieceType.EMPTY) {
            throw new Error('Cant move an EMPTY piece.')
        }

        // Always add the index that is has been to
        this.turnMoveIndexes.push(index);

        const willWithdraw = this.willMoveWithdraw(index, pieceType, direction);
        const willApproach = this.willMoveApproach(index, pieceType, direction);

        let attackType: AttackType = AttackType.NONE;
        
        if (willApproach && willWithdraw) {
            // If this is a bot playing, it will not have set the attackType, so just assume approach
            if (this.attackOrWithdraw === AttackType.NONE) {
                attackType = AttackType.APPROACH;
            } else {
                attackType = this.attackOrWithdraw;
            }
        } else if (willWithdraw) {
            attackType = AttackType.WITHDRAW;
        } else if (willApproach) {
            attackType = AttackType.APPROACH;
        }

        // Reset the attack type
        this.attackOrWithdraw = AttackType.NONE;

        // Set the new index after moving
        index = this.movePiece(pieceType, index, direction);
        // Track where the piece is now, since only this piece can move again in this turn.
        this.currentlyMovingPiece = index;
        if (attackType !== AttackType.NONE) {
            this.removeAttackedPieces(index, pieceType, direction, attackType);
            const canMoveAgain = this.canContinueAttackChain(index, pieceType, direction);
            if (canMoveAgain) {
                return true;
            }
        }
        // If the player cant move again, reset the index tracker and the turn
        if (!virtualMove) {
            // Every move in a capture chain is an attack, so the turn captured something exactly when its last move did.
            this.finishTurn(attackType !== AttackType.NONE);
        }
        return false;
    }

    /**
     * Only the first capture of a turn is compulsory, so after any capture the player may stop even if they
     * could keep capturing.
     * @returns whether the current player is in the middle of a capture chain and can choose to end their turn.
     */
    public canEndTurn(): boolean {
        return this.currentlyMovingPiece !== null
            && this.turnMoveIndexes.length > 0
            && this.getWinner() === Winner.NONE;
    }

    /**
     * Ends the current player's turn in the middle of a capture chain (see canEndTurn).
     */
    public endTurn(): void {
        if (!this.canEndTurn()) {
            throw new Error('The turn can only be ended in the middle of a capture chain.');
        }
        // A turn can only be in the middle of a chain after a capture.
        this.finishTurn(true);
    }

    /**
     * Resets the turn tracking and passes the turn to the other player.
     * @param captured whether any pieces were captured during the turn.
     */
    private finishTurn(captured: boolean): void {
        this.turnsWithoutCapture = captured ? 0 : this.turnsWithoutCapture + 1;
        this.turnMoveIndexes = [];
        this.currentlyMovingPiece = null;
        this.currentTurn = this.currentTurn ? Turn.WHITE : Turn.BLACK;
    }

    public getTurn() {
        return this.currentTurn;
    }

    private getEmptyCellsThatHaventBeenVisited(index: number) {
        const result = this.board[index].getNeighbours()
            .filter((neighbour) => 
                neighbour.cell.getPieceType() === PieceType.EMPTY
                && !this.turnMoveIndexes.includes(neighbour.cell.getIndex()))
            .map(neighbour => ({index: neighbour.cell.getIndex(), direction: neighbour.direction}));
        return result;
    }

    /**
     * Returns the possible moves for this cell. If there are only paika moves, those can all be returned. 
     * Otherwise if there are any attacking moves, only those moves are returned.
     * @param {number} index the index of the cell we want the moves from.
     * @returns {Move[]} an array of possible moves.
     */
    public getPossibleMovesForCell(index: number): Move[] {
        if (this.getWinner() !== Winner.NONE) return [];

        const pieceType = this.board[index].getPieceType();
        let moves: {index: number, direction: Direction }[] = this.getEmptyCellsThatHaventBeenVisited(index);

        // Return early if there are no moves
        if (moves.length === 0) {
            return [];
        }

        // If player is in the middle of a turn with previous moves, filter out all the indexes they have been to as they can't move there again.
        if (this.turnMoveIndexes.length !== 0) {
            // The piece also can't move in the same direction as its previous move (moving in the opposite direction
            // is already prevented since that would return it to the cell it just left).
            const previousMoveDelta = index - this.turnMoveIndexes[this.turnMoveIndexes.length - 1];
            moves = moves.filter(move => move.index - index !== previousMoveDelta);

            let attackingMoves: Move[] = [];
            for (let i = 0; i < moves.length; i++) {
                if (this.willMoveApproach(index, pieceType, moves[i].direction)) {
                    attackingMoves.push({ index: moves[i].index, direction: moves[i].direction, attackType: AttackType.APPROACH });
                }
                if (this.willMoveWithdraw(index, pieceType, moves[i].direction)) {
                    attackingMoves.push({ index: moves[i].index, direction: moves[i].direction, attackType: AttackType.WITHDRAW });
                }
            }
            return attackingMoves;
        
        // Otherwise its their first move in the turn, so they can use a paika move if no attacking moves are available
        } else {
            // If any of the moves are attacking, just return those. Otherwise just return the complete list of moves.
            let attackingMoves: Move[] = [];
            for (let i = 0; i < moves.length; i++) {
                if (this.willMoveApproach(index, pieceType, moves[i].direction)) {
                    attackingMoves.push({ index: moves[i].index, direction: moves[i].direction, attackType: AttackType.APPROACH });
                }
                if (this.willMoveWithdraw(index, pieceType, moves[i].direction)) {
                    attackingMoves.push({ index: moves[i].index, direction: moves[i].direction, attackType: AttackType.WITHDRAW });
                }
            }
            return attackingMoves!.length > 0 ? attackingMoves! : moves.map(move => ({ ...move, attackType: AttackType.NONE }));
        }
    }

    /**
     * @param {number} currentMove the index where the piece is before the move.
     * @param {PieceType} attackPieceType the type of the piece being moved.
     * @param {Direction} attackDirection the direction the piece was moved in order to get to the moveIndex.
     * @returns {boolean} whether the move will approach an opponents piece.
     */
    private willMoveApproach(currentIndex: number, attackPieceType: PieceType, attackDirection: Direction): boolean {
        const attackDelta = getDeltaIndex(attackDirection, this.columns);
        const possibleAttackedPieceIndex: number = currentIndex + 2 * attackDelta;
        const isAttackedPieceConnected = this.board[currentIndex + attackDelta].getCellConnections().some(connection => connection.index === possibleAttackedPieceIndex);
        if (this.isPositionOnBoard(possibleAttackedPieceIndex) 
            && isAttackedPieceConnected
            && this.board[possibleAttackedPieceIndex].isPieceType(getOppositePieceType(attackPieceType))) {
            return true;
        }
        return false;
    }

    /**
     * @param {number} currentIndex the current index of the piece to be moved. 
     * @param {PieceType} attackPieceType the type of piece being moved.
     * @param {Direction} moveDirection the direction the piece will be moved in.
     * @returns {boolean} whether moving this piece will cause an opponents piece to be "withdrawn" from.
     */
    private willMoveWithdraw(currentIndex: number, attackPieceType: PieceType, moveDirection: Direction): boolean {
        const possibleAttackedPieceIndex: number = currentIndex + getDeltaIndex(getOppositeDirection(moveDirection), this.columns);
        const isAttackedPieceConnected = this.board[currentIndex].getCellConnections().some(connection => connection.index === possibleAttackedPieceIndex);
        if (this.isPositionOnBoard(possibleAttackedPieceIndex) 
            && isAttackedPieceConnected
            && this.board[possibleAttackedPieceIndex].isPieceType(getOppositePieceType(attackPieceType))) {
            return true;
        }
        return false;
    }

    /**
     * Returns true if a piece has an empty neighbour (which it could move to)
     * @param {number} index the index of the piece/cell
     */
    private doesPieceHaveEmptyNeighbours(index: number): boolean {
        // Early return if we have accidentally asked to move a cell that is empty
        if (this.board[index].getPieceType() === PieceType.EMPTY) {
            return false;
        }
        return this.board[index].getNeighbours().some(neighbour => neighbour.cell.getPieceType() === PieceType.EMPTY);
    }

    /**
     * @param index the piece to check.
     * @returns {boolean} whether this piece can attack any opponents pieces.
     */
    private canPieceAttack(index: number): boolean {
        // Early return if we have accidentally asked to move a cell that is empty
        if (this.board[index].getPieceType() === PieceType.EMPTY) {
            return false;
        }
        const possibleMoves: { index: number, direction: Direction }[] = this.getEmptyNeighbouringCellsAsMoves(index);
        const attackingPieceType = this.board[index].getPieceType();
        return (possibleMoves.some(move => this.willMoveApproach(index, attackingPieceType, move.direction)) || possibleMoves.some(move => this.willMoveWithdraw(index, attackingPieceType, move.direction)));
    }

    /**
     * Called after an attack has been made in performMove. Checks whether the piece can attack again
     * in a new direction (continuing the chain). Always requires the next move to be an attack.
     * @param currentIndex the current index of the piece after the last attack.
     * @param pieceType the piece type of the player.
     * @param previousAttackdirection the direction of the attack just made.
     * @returns true if the piece can continue attacking.
     */
    private canContinueAttackChain(currentIndex: number, pieceType: PieceType, previousAttackdirection: Direction | null): boolean {
        // We check that there is at least a single neighbour of the current index of the piece that meet all of the following criteria:
        // 1) EMPTY, 2) not the original index of the piece in this turn, 3) in a different direction the last directon's move,
        // and 4) are attacking moves.
        return this.getEmptyNeighbouringCellsAsMoves(currentIndex)
            .some(move =>
                !this.turnMoveIndexes.includes(move.index) &&
                move.direction !== previousAttackdirection &&
                (!previousAttackdirection || move.direction !== getOppositeDirection(previousAttackdirection)) &&
                (this.willMoveApproach(currentIndex, pieceType, move.direction) || this.willMoveWithdraw(currentIndex, pieceType, move.direction)));
    }

    /**
     * Called when building the move tree to decide whether a node has children. Allows paika (non-attacking)
     * moves when previousAttackdirection is null (the first move of the turn). Use canContinueAttackChain
     * in performMove instead — that call site always has a previous direction and always requires an attack.
     * @param currentIndex the current index of the piece.
     * @param pieceType the piece type of the player.
     * @param previousAttackdirection the direction of the previous move, or null if this is the first move.
     * @returns true if the piece has at least one legal move available.
     */
    private hasLegalMove(currentIndex: number, pieceType: PieceType, previousAttackdirection: Direction | null): boolean {
        if (this.getWinner() !== Winner.NONE) return false;
        const emptyNeighbouringMoves = this.getEmptyNeighbouringCellsAsMoves(currentIndex);
    
        // If there are no empty neighbouring cells, the player cannot move
        if (emptyNeighbouringMoves.length === 0) {
            return false;
        }
    
        // We check that there is at least a single neighbour of the current index of the piece that meet all of the following criteria:
        // 1) EMPTY, 2) not the original index of the piece in this turn, 3) in a different direction the last directon's move,
        // and 4) are attacking moves if there is a previous direction or paika moves if its the first move.
        return emptyNeighbouringMoves.some(move => {
            const isNotAnIndexPreviouslyVisited = !this.turnMoveIndexes.includes(move.index);
            const isDifferentDirection = move.direction !== previousAttackdirection;
            const isNotOppositeDirection = previousAttackdirection === null || move.direction !== getOppositeDirection(previousAttackdirection);
            const isAttackOrWithdraw = previousAttackdirection === null || (this.willMoveApproach(currentIndex, pieceType, move.direction) || this.willMoveWithdraw(currentIndex, pieceType, move.direction));
    
            return isNotAnIndexPreviouslyVisited && isDifferentDirection && isNotOppositeDirection && isAttackOrWithdraw;
        });
    }
    /**
     * Removes at least one of the opponents pieces including all those in the same direction of the WITHDRAW or APPROACH until
     * there is 1) a cell that doesnt contain the opponents piece type or if 2) the edge of the board has been reached. 
     * @param currentIndex the current index of the piece, that is after the move has been made.
     * @param pieceType the type of piece that made the move.
     * @param direction the direction of the attacking piece.
     * @param attackType whether the attack was a WITHDRAW or APPROACH.
     */
    private removeAttackedPieces(currentIndex: number, pieceType: PieceType, direction: Direction, attackType: AttackType): void {
        // In this function, the default move is considered APPROACH. If it is a WITHDRAW, we set the direction to the opposite, and first return
        // the piece index to where it was before the move. Then we can continue "as if" the move was an APPROACH, and it should work the same.
        let deltaIndexFromDirection: number = getDeltaIndex(direction, this.columns);
        if (attackType === AttackType.WITHDRAW) {
            deltaIndexFromDirection *= -1;
            // If we are withdrawing, we first need to return to the index where the piece was moved from.
            currentIndex += deltaIndexFromDirection;
        }
        currentIndex += deltaIndexFromDirection;
        const oppositePieceType = getOppositePieceType(pieceType);
        let isChainStillConnected: boolean = true;
        while (this.isPositionOnBoard(currentIndex) && this.board[currentIndex].getPieceType() === oppositePieceType && isChainStillConnected) {
            this.board[currentIndex].removePiece();
            // Track the removal of this piece so we can easily know how many pieces of each type on the board.
            pieceType === PieceType.WHITE ? this.numBlackPieces-- : this.numWhitePieces--;
            const previousIndex = currentIndex;
            currentIndex += deltaIndexFromDirection;
            isChainStillConnected = this.board[previousIndex].getCellConnections().some(connection => connection.index === currentIndex);
        }
    }

    /**
     * Move the piece (note that no other calculations about opponent pieces destroyed are done).
     * @param {PieceType} piece the type of piece that has been moved (we use this to validate we are not moving an empty cell).
     * @param {number} index the index of the piece being moved.
     * @param {Direction} direction the direction to move the piece.
     * @returns {number} the new index of the piece.
     */
    private movePiece(piece: PieceType, index: number, direction: Direction): number {
        // TODO some move validation
        const newIndex = index + getDeltaIndex(direction, this.columns);
        
        if (this.board[newIndex].getPieceType() !== PieceType.EMPTY) {
            throw new Error('The place the piece is being moved is occupied');
        }

        this.setCell(newIndex, piece);
        this.board[index].removePiece();
        return newIndex;
    }

    /**
     * @param index the index of the cell to check for moves.
     * @returns a list of Move[] that a piece in the cell could move to.
     */
    private getEmptyNeighbouringCellsAsMoves(index: number): { index: number, direction: Direction }[] {
        return this.board[index].getNeighbours()
            .filter((neighbour) => neighbour.cell.getPieceType() === PieceType.EMPTY)
            .map(neighbour => ({index: neighbour.cell.getIndex(), direction: neighbour.direction}));
    }

    private isPositionOnBoard(index: number): boolean {
        return index >= 0 && index < this.rows * this.columns;
    }

    private setCell(index: number, pieceType: PieceType): void {
        this.board[index].setPieceType(pieceType);
    }

    public getAllPossibleCompleteMoves(pieceType: PieceType): { startIndexes: number[], moves: CompleteMove[][] } {
        const piecesThatCanMove = this.getPiecesThatPlayerCanMove(pieceType);
        let moves: CompleteMove[][] = [];
        let startIndexes: number[] = [];
        for (let i = 0; i < piecesThatCanMove.length; i++) {
            const movesForPiece = this.getAllPossibleMovesForSinglePiece(piecesThatCanMove[i]);
            startIndexes.push(piecesThatCanMove[i]);
            moves[i] = [];
            for (let j = 0; j < movesForPiece.length; j++) {
                moves[i].push(movesForPiece[j]);
            }
        }

        return { startIndexes: startIndexes, moves: moves };
    }

    public getAllPossibleMovesForSinglePiece(index: number): CompleteMove[] {
        const allMovesTree = this.buildMoveTreeForSinglePiece(index, this.board[index].getPieceType(), null, AttackType.NONE);
        return this.getAllPaths(allMovesTree);
        
    }

    private getAllPaths(node: TreeNode<number>): CompleteMove[] {
        const paths: CompleteMove[] = [];
    
        function traverse(currentNode: TreeNode<number>, currentPath: CompleteMove, isRoot: boolean): void {
            // Clone the path to ensure immutability for each branch
            const newPath: CompleteMove = {
                moveIndexes: isRoot ? [...currentPath.moveIndexes] : [...currentPath.moveIndexes, currentNode.value],
                moveTypes: isRoot ? [...currentPath.moveTypes] : [...currentPath.moveTypes, currentNode.attackType],
            };

            // If the node has no children, it’s a leaf node—record the path
            if (currentNode.children.length === 0) {
                paths.push(newPath);
                return;
            }

            // Only the first capture is compulsory, so the player can also stop after any capture in the chain.
            // Record that as a complete move too (before the moves that continue the chain).
            if (!isRoot && currentNode.attackType !== AttackType.NONE) {
                paths.push(newPath);
            }
    
            // Traverse all children
            for (const child of currentNode.children) {
                traverse(child, newPath, false); // Root flag is false for children
            }
        }
    
        const initialMove: CompleteMove = {
            moveIndexes: [],
            moveTypes: [],
        };
    
        traverse(node, initialMove, true); // Start traversal with the root node
        // Filter out paths with empty moveIndexes and moveTypes
        const validPaths = paths.filter(path => path.moveIndexes.length > 0 || path.moveTypes.length > 0);
        return validPaths;
    }

    /**
     * 
     * @param index the index of the piece we are moving.
     * @param pieceType the type of piece we are building a move tree for.
     * @param previousMoveDirection the direction of the previous move (null for the first node).
     * @returns 
     */
    private buildMoveTreeForSinglePiece(
        index: number,
        pieceType: PieceType,
        previousMoveDirection: Direction | null,
        attackType: AttackType,
    ): TreeNode<number> {
        const node: TreeNode<number> =  {
            value: index,
            children: [],
            // A paika (non-attacking) move always ends the turn, so it can't be followed by an attack.
            isComplete: (previousMoveDirection !== null && attackType === AttackType.NONE)
                || !this.hasLegalMove(index, pieceType, previousMoveDirection),
            attackType: attackType,
        };

        const boardState = this.saveBoardState();

        // Get possible moves from the current index
        const possibleMoves = this.getPossibleMovesForCell(index);

        // If the chain is complete, stop recursion
        if (node.isComplete) {
            return node;
        }
    
        // For each possible move, create a child node
        for (const nextMove of possibleMoves) {
            const localBoardState = this.saveBoardState();
            this.setAttackOrWithdraw(nextMove.attackType);
            this.performMove(index, nextMove.direction, true);
            const childNode = this.buildMoveTreeForSinglePiece(
                nextMove.index, 
                pieceType, 
                nextMove.direction, 
                nextMove.attackType);
            this.resetBoardState(localBoardState);
            node.children.push(childNode);
        }
        
        this.resetBoardState(boardState);

        return node;
    }

    /**
     * Plays a complete turn (every step of a CompleteMove) for real, so that afterwards the turn has passed to the
     * opponent. Use saveBoardState/resetBoardState around this to explore a move without keeping it.
     * @param startIndex the index of the piece being moved at the start of the turn.
     * @param move the complete move, as returned by getAllPossibleCompleteMoves.
     */
    public applyCompleteMove(startIndex: number, move: CompleteMove): void {
        let index = startIndex;
        for (let i = 0; i < move.moveIndexes.length; i++) {
            const nextIndex = move.moveIndexes[i];
            const direction = getDirectionFromDeltaIndex(nextIndex - index, this.columns);
            this.setAttackOrWithdraw(move.moveTypes[i]);
            const canMoveAgain = this.performMove(index, direction);
            const isLastStep = i === move.moveIndexes.length - 1;
            if (!canMoveAgain && !isLastStep) {
                throw new Error('The complete move does not match the moves allowed by the board.');
            }
            // The move stops part way through a capture chain, so end the turn here.
            if (canMoveAgain && isLastStep) {
                this.endTurn();
            }
            index = nextIndex;
        }
    }

    /**
     * @param pieceType the player whose pieces we want to count.
     * @returns the number of pieces that player has left on the board.
     */
    public getNumPieces(pieceType: PieceType): number {
        if (pieceType === PieceType.WHITE) return this.numWhitePieces;
        if (pieceType === PieceType.BLACK) return this.numBlackPieces;
        return 0;
    }

    /**
     * @returns whether the cell at this index is a strong intersection (connected in all 8 directions).
     */
    public isStrongCell(index: number): boolean {
        return this.board[index].getCellType() === CellType.STRONG;
    }

    /**
     * @returns the indexes of all the cells connected to this cell.
     */
    public getConnectedIndexes(index: number): number[] {
        return this.board[index].getCellConnections().map(connection => connection.index);
    }

    /**
     * Finds every one of the defender's pieces that the attacker could capture with the first step of their
     * next turn. Only the first step is considered (not the whole capture chain) to keep this cheap.
     * Should only be called between turns (not in the middle of a capture chain).
     * @param attacker the player who would be attacking.
     * @returns the indexes of the defender's pieces that could be captured.
     */
    public getCapturablePieces(attacker: PieceType): Set<number> {
        const capturable = new Set<number>();
        const defender = getOppositePieceType(attacker);
        const boardState = this.saveBoardState();
        for (const index of this.getPiecesThatPlayerCanMove(attacker)) {
            for (const move of this.getPossibleMovesForCell(index)) {
                if (move.attackType === AttackType.NONE) continue;
                this.setAttackOrWithdraw(move.attackType);
                this.performMove(index, move.direction, true);
                for (let i = 0; i < this.board.length; i++) {
                    if (boardState.positions[i] === defender && this.board[i].getPieceType() === PieceType.EMPTY) {
                        capturable.add(i);
                    }
                }
                this.resetBoardState(boardState);
            }
        }
        return capturable;
    }

}