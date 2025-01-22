import Cell  from './Cell.js';
import { Winner, PieceType, getDeltaIndex, getOppositePieceType, getOppositeDirection, Direction, Move, AttackType, CellType, Turn, CompleteMove, TreeNode, BoardState } from './types.js';

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
        this.attackOrWithdraw = AttackType.NONE;
    }

    private resetPiecePositions(positions: number[]) {
        for (let i = 0; i < this.rows * this.columns; i++) {
            this.board[i].setPieceType(positions[i]);
        }
    }

    public reset() {
        this.resetPiecePositions(this.startingPiecePositions);
        this.turnMoveIndexes = []; 
        this.currentlyMovingPiece = null;
        this.currentTurn = Turn.WHITE;
        this.attackOrWithdraw = AttackType.NONE;
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
        };
    }


    /**
     * @returns {Winner} the winner of the game or Winner.None if there is no winner yet.
     */
    public getWinner(): Winner {
        if (this.numBlackPieces === 0) {
            return Winner.WHITE;
        }
        if (this.numWhitePieces === 0) {
            return Winner.BLACK;
        }
        return Winner.NONE;
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
        if (attackType === AttackType.NONE) {
            throw new Error('You can only set the attack type to APPROACH or WITHDRAW');
        }
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
    public performMove(index: number, direction: Direction): boolean {
        if (!(direction in Direction)) {
            throw new Error('Invalid direction when trying to move a piece.');
        }
        const pieceType: PieceType = this.board[index].getPieceType();
        if (pieceType === PieceType.EMPTY) {
            throw new Error('Cant move an EMPTY piece.')
        }




        this.currentlyMovingPiece = index;

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
        if (attackType !== AttackType.NONE) {
            this.removeAttackedPieces(index, pieceType, direction, attackType);
            const canMoveAgain = this.canPlayerMoveAgain(index, pieceType, direction);
            if (canMoveAgain) {
                return true;
            }
        }
        // If the player cant move again, reset the index tracker and the turn
        this.turnMoveIndexes = [];
        this.currentlyMovingPiece = null;
        this.currentTurn = this.currentTurn ? Turn.WHITE : Turn.BLACK;
        return false;
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
        // TODO FIGURE OUT WHY IN TREE THIS IS RETURNING MOVES THAT HAVE ALREADY BEEN MOVED TO
        let moves: {index: number, direction: Direction }[] = this.getEmptyCellsThatHaventBeenVisited(index);
        console.log("cells we have visited",this.turnMoveIndexes);
        console.log("cells that havent been visited or are around our piece", moves);
        

        // Return early if there are no moves
        if (moves.length === 0) {
            return [];
        }

        // If player is in the middle of a turn with previous moves, filter out all the indexes they have been to as they can't move there again.
        if (this.turnMoveIndexes.length !== 0) {
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
     * Determines whether the player can move again. This move must be attacking and neither in the same direction or reaching the same spot as the piece
     * has previously been in this turn. Assumes a move has already been made in the players turn.
     * @param currentIndex the current index of the piece.
     * @param pieceType the piece type of the player.
     * @param previousAttackdirection the direction the last move in the turn attacked.
     * @returns true if the player can play another move.
     */
    private canPlayerMoveAgain(currentIndex: number, pieceType: PieceType, previousAttackdirection: Direction | null): boolean {
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

    private getAllPossibleCompleteMoves(pieceType: PieceType): CompleteMove[] {
        const piecesThatCanMove = this.getPiecesThatPlayerCanMove(pieceType);
        const originalBoardState = this.saveBoardState();
        let allMoves: CompleteMove[] = [];
        for (let i = 0; i < piecesThatCanMove.length; i++) {
            const movesForPiece = this.getAllPossibleMovesForSinglePiece(piecesThatCanMove[i]);
            for (let j = 0; j < movesForPiece.length; j++) {
                allMoves.push(movesForPiece[j]);
            }
        }

        return allMoves;
    }

    public getAllPossibleMovesForSinglePiece(index: number): CompleteMove[] {
        const allMovesTree = this.buildMoveTreeForSinglePiece(index, this.board[index].getPieceType(), null, AttackType.NONE);
        return this.getAllPaths(allMovesTree, index);
        
    }

    private getAllPaths(node: TreeNode<number>, startIndex: number): CompleteMove[] {
        const paths: CompleteMove[] = [];
    
        function traverse(currentNode: TreeNode<number>, currentPath: CompleteMove): void {
            // Clone the path to ensure immutability for each branch
            const newPath: CompleteMove = {
                initialMovingPieceIndex: currentPath.initialMovingPieceIndex,
                moveIndexes: [...currentPath.moveIndexes, currentNode.value],
                moveTypes: [...currentPath.moveTypes, currentNode.attackType],
            };
    
            // If the node has no children, it’s a leaf node—record the path
            if (currentNode.children.length === 0) {
                paths.push(newPath);
                return;
            }
    
            // Traverse all children
            for (const child of currentNode.children) {
                traverse(child, newPath);
            }
        }
    
        const initialMove: CompleteMove = {
            initialMovingPieceIndex: startIndex,
            moveIndexes: [],
            moveTypes: [],
        };
    
        traverse(node, initialMove);
        return paths;
    }

    /**
     * 
     * @param index the index of the piece we are moving.
     * @param pieceType the type of piece we are building a move tree for.
     * @param previousMoveDirection the direction of the previous move (null for the first node).
     * @returns 
     */


    //// GOING TO HAVE TO FIGURE OUT HOW TO RESET THE STATE OF THE BOARD EACH TIME
    private buildMoveTreeForSinglePiece(
        index: number,
        pieceType: PieceType,
        previousMoveDirection: Direction | null,
        attackType: AttackType,
    ): TreeNode<number> {
        // HAVE TO FIGURE OUT HOW TO GET THE FIRST ATTACK TYPE TO NOT BE NONE, OR TO NOT STORE THE FIRST NODE AS THE FIRST INDEX WE ARE STARTING AT

        //console.log('Can player move again:', this.canPlayerMoveAgain(index, pieceType, previousMoveDirection));
        const node: TreeNode<number> = {
            value: index,
            children: [],
            isComplete: !this.canPlayerMoveAgain(index, pieceType, previousMoveDirection),
            attackType: attackType,
        };

        //console.log("saving main board state");
        const boardState = this.saveBoardState();
        //console.log(this.saveBoardState());

        // Get possible moves from the current index
        //console.log("searching possible moves");
        const possibleMoves = this.getPossibleMovesForCell(index);
        //console.log('Get possible moves:', this.getPossibleMovesForCell(index));
    
        // If the chain is complete, stop recursion
        if (node.isComplete) {
            //console.log("turn is complete");
            return node;
        }
    
        // For each possible move, create a child node
        for (const nextMove of possibleMoves) {
            //console.log("searching child node ", nextMove.index);
            const localBoardState = this.saveBoardState();
            //console.log("saving local board state");
            //console.log(this.saveBoardState());
            this.setAttackOrWithdraw(nextMove.attackType);
            //console.log("moving piece");
            this.performMove(index, nextMove.direction);
            const childNode = this.buildMoveTreeForSinglePiece(nextMove.index, pieceType, nextMove.direction, nextMove.attackType);
            //console.log("resetting local board state");
            this.resetBoardState(localBoardState);
            //console.log(this.saveBoardState());
            node.children.push(childNode);
        }
        
        //console.log("resetting main board state", boardState);
        this.resetBoardState(boardState);

        return node;
    }
}