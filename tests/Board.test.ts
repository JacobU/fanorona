// import { expect } from 'chai';
// import Board from '../src/Board.js';
// import { AttackType, BoardState, Direction, Move, PieceType, Turn, Winner } from '../src/types.js';

// describe('Board Tests', () => {

//     const emptyRow5: string = '00000';
//     const emptyRow3: string = '000';

//     it('should initialize correctly', () => {
//         const board = new Board();
//         expect(board).to.be.an('object');
//     });

//     it('should output the correct board after init', () => {
//         const boardPositionString = "120000000";
//         const board = new Board(3, 3, boardPositionString);
//         expect(board.getBoardPositionsAsString()).equals(boardPositionString);
//     });

//     // Check correct possible moves
//     it('should provide correct possible moves for 3x3 board on weak intersections', () => {
//         const boardPositionString = "000102000";
//         const board = new Board(3, 3, boardPositionString);

//         const directionsForWhite: Move[] = [
//             { index: 4, direction: Direction.RIGHT, attackType: AttackType.APPROACH },
//         ];
//         const directionsForBlack: Move[] = [
//             { index: 4, direction: Direction.LEFT, attackType: AttackType.APPROACH },
//         ];
        
//         expect(board.getPossibleMovesForCell(3)).to.deep.equal(directionsForWhite);
//         expect(board.getPossibleMovesForCell(5)).to.deep.equal(directionsForBlack);
//     });

//     it('should provide all the possible moves for 3x3 board on a strong intersection', () => {
//         const expectedEmptyBoardMoves: Move[] = [
//             { index: 0, direction: Direction.UPLEFT, attackType: AttackType.NONE },
//             { index: 1, direction: Direction.UP, attackType: AttackType.NONE  },
//             { index: 2, direction: Direction.UPRIGHT, attackType: AttackType.NONE  },
//             { index: 3, direction: Direction.LEFT, attackType: AttackType.NONE  },
//             { index: 5, direction: Direction.RIGHT, attackType: AttackType.NONE  },
//             { index: 6, direction: Direction.DOWNLEFT, attackType: AttackType.NONE  },
//             { index: 7, direction: Direction.DOWN, attackType: AttackType.NONE  },
//             { index: 8, direction: Direction.DOWNRIGHT, attackType: AttackType.NONE  },
//         ]
        
//         const board = new Board(3, 3, emptyRow3 + '010' + emptyRow3);

//         let boardPositions = board.saveBoardPositions();
//         // THIS IS AN INCORRECT STATE JUST TO ALLOW US TO TEST THE MULTIPLE POSITIONS!
//         let boardState: BoardState = { positions: boardPositions, numWhitePieces: 1, numBlackPieces: 1, turn: Turn.WHITE };

//         board.resetBoardState(boardState);

//         expect(board.getPossibleMovesForCell(4)).to.deep.equal(expectedEmptyBoardMoves);

//         // Situation 2: Completely surrounded by pieces of its own type. Shouldnt be able to move anywhere.
        
//         const whiteFilledBoard = new Board(3, 3, '111111111');
//         expect(whiteFilledBoard.getPossibleMovesForCell(4)).to.be.empty;

//         // Situation 3: Completely surrounded by pieces of its opponents type. Should be able to move anywhere.
//         const blackFilledBoard = new Board(3, 3, '222212222');
//         expect(blackFilledBoard.getPossibleMovesForCell(4)).to.be.empty;

//         // Situation 4: Surrounded on the sides except for two piaka moves (up or down). Should have only those two options.
//         // NOTE: When debugging remember the indexes of the Move[] and Neighbour[] arrays wont match.
//         const piakaMovesBoard = new Board(3, 3, '202212202')
//         const expectedUpDownPaikaMoves: Move[] = [
//             { index: 1, direction: Direction.UP, attackType: AttackType.NONE  },
//             { index: 7, direction: Direction.DOWN, attackType: AttackType.NONE  },
//         ]

//         expect(piakaMovesBoard.getPossibleMovesForCell(4)).to.deep.equal(expectedUpDownPaikaMoves);

//         // Situation 5: Should have 2 paika moves (up or down) but also an attacking move. Only the attacking move should be returned.
//         const singleAttackBoard = new Board(3, 3, '200212202');
//         const expectedAttackMove: Move[] = [ { index: 2, direction: Direction.UPRIGHT, attackType: AttackType.WITHDRAW } ];
        
//         expect(singleAttackBoard.getPossibleMovesForCell(4)).to.deep.equal(expectedAttackMove);

//         // Situation 6: Should have 2 paika moves (up or down) but also 2 attacking moves. Only the attacking moves should be returned.
//         const doubleAttackBoard = new Board(3, 3, '200212200');
//         const expectedAttackMoves: Move[] = [ 
//             { index: 2, direction: Direction.UPRIGHT, attackType: AttackType.WITHDRAW  },
//             { index: 8, direction: Direction.DOWNRIGHT, attackType: AttackType.WITHDRAW  },
//         ];
        
//         expect(doubleAttackBoard.getPossibleMovesForCell(4)).to.deep.equal(expectedAttackMoves);
//     });

//     it('should return the correct cells that can move', () => {
//         // Situation 1: No cells on that piece type on the board. Should return empty list.
//         const noBlackCellsBoard = new Board(3, 3, '000111111');
//         expect(noBlackCellsBoard.getPiecesThatPlayerCanMove(PieceType.BLACK)).to.be.empty;

//         // Situation 2: 1 cell of that type on the board. Should return that cell.
//         const oneBlackCellBoard = new Board(3, 3, '000121111');
//         expect(oneBlackCellBoard.getPiecesThatPlayerCanMove(PieceType.BLACK)).to.deep.equal([4]);

//         // Situation 3: 1 cell of that type with piaka move, the other with attacking move. Should return attacking cell.
//         const singleAttackSinglePaikaCellBoard = new Board(3, 3, '200121111');
//         expect(singleAttackSinglePaikaCellBoard.getPiecesThatPlayerCanMove(PieceType.BLACK)).to.deep.equal([4]);

//         // Situation 4: Same as 3, but different with white pieces.
//         const singleAttackSinglePaikaCellBoardWhite = new Board(3, 3, '100212222');
//         expect(singleAttackSinglePaikaCellBoardWhite.getPiecesThatPlayerCanMove(PieceType.WHITE)).to.deep.equal([4]);

//         // Situation 5: 2 cells that can attack. Should return those two.
//         const doubleAttackCellBoard = new Board(3, 3, '201121111');
//         expect(doubleAttackCellBoard.getPiecesThatPlayerCanMove(PieceType.BLACK)).to.deep.equal([0, 4]);
//     });

//     it('should remove correct pieces after diagonal withdrawal', () => {
//         // Withdraw diagonal
//         const boardPositionsBeforeDiagonalWithdrawal: string = '200000200000100' + emptyRow5 + emptyRow5;
//         const board = new Board(5, 5, boardPositionsBeforeDiagonalWithdrawal);

//         // Do withdrawal
//         const canMoveAgain = board.performMove(12, Direction.DOWNRIGHT);
//         expect(canMoveAgain).to.equal(false);

//         const boardPositionsAfterDiagonalWithdrawal: string = emptyRow5 + emptyRow5 + emptyRow5 + '00010' + emptyRow5;
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterDiagonalWithdrawal);
//         expect(board.getWinner()).to.be.equal(Winner.WHITE);
//     });

//     it('should remove correct pieces after diagonal approach', () => {
//         // Approach diagonal
//         const boardPositionsBeforeDiagonalApproach: string = '2000002000' + emptyRow5 + '00010' + emptyRow5;
//         const board = new Board(5, 5, boardPositionsBeforeDiagonalApproach);

//         // Do approach
//         const canMoveAgain = board.performMove(18, Direction.UPLEFT);
//         expect(canMoveAgain).to.equal(false);

//         const boardPositionsAfterDiagonalApproach: string = emptyRow5 + emptyRow5 + '00100' + emptyRow5 + emptyRow5;
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterDiagonalApproach);
//         expect(board.getWinner()).to.be.equal(Winner.WHITE);
//     });

//     it('should remove correct pieces after horizontal withdrawal', () => {
//         // Withdraw horizontal
//         const boardPositionsBeforeHorizontalWithdrawal: string = emptyRow5 + emptyRow5 + '22100' + emptyRow5 + emptyRow5;
//         const board = new Board(5, 5, boardPositionsBeforeHorizontalWithdrawal);

//         // DO WITHDRAWAL
//         const canMoveAgain = board.performMove(12, Direction.RIGHT);
//         expect(canMoveAgain).to.equal(false);

//         const boardPositionsAfterHorizontalWithdrawal: string = emptyRow5 + emptyRow5 + '00010' + emptyRow5 + emptyRow5;
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterHorizontalWithdrawal);
//         expect(board.getWinner()).to.be.equal(Winner.WHITE);
//     });

//     it('should remove correct pieces after horizontal approach', () => {
//         // Approach horizontal
//         const boardPositionsBeforeHorizontalApproach: string = emptyRow5 + emptyRow5 + '22010' + emptyRow5 + emptyRow5;
//         const board = new Board(5, 5, boardPositionsBeforeHorizontalApproach);

//         // DO APPROACH
//         const canMoveAgain = board.performMove(13, Direction.LEFT);
//         expect(canMoveAgain).to.equal(false);

//         const boardPositionsAfterHorizontalApproach: string = emptyRow5 + emptyRow5 + '00100' + emptyRow5 + emptyRow5;
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterHorizontalApproach);
//         expect(board.getWinner()).to.be.equal(Winner.WHITE);
//     });

//     it('should remove correct pieces after vertical withdrawal', () => {
//         // Withdraw vertical
//         const boardPositionsBeforeVerticalWithdrawal: string = '00200'+ '00200' + '00100' + emptyRow5 + emptyRow5;
//         const board = new Board(5, 5, boardPositionsBeforeVerticalWithdrawal);

//         // DO WITHDRAWAL
//         const canMoveAgain = board.performMove(12, Direction.DOWN);
//         expect(canMoveAgain).to.equal(false);

//         const boardPositionsAfterVerticalWithdrawal: string = emptyRow5 + emptyRow5 + emptyRow5 + '00100' + emptyRow5;
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterVerticalWithdrawal);
//         expect(board.getWinner()).to.be.equal(Winner.WHITE);
//     });

//     it('should remove correct pieces after vertical approach', () => {
//         // Approach vertical
//         const boardPositionsBeforeVerticalApproach: string = '00200'+ '00200' + emptyRow5 + '00100' + emptyRow5;
//         const board = new Board(5, 5, boardPositionsBeforeVerticalApproach);

//         const canMoveAgain = board.performMove(17, Direction.UP);
//         expect(canMoveAgain).to.equal(false);

//         // DO WITHDRAWAL
//         const boardPositionsAfterVerticalApproach: string = emptyRow5 + emptyRow5 + '00100' + emptyRow5 + emptyRow5;
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterVerticalApproach);
//         expect(board.getWinner()).to.be.equal(Winner.WHITE);
//     });
    
    
//     it('should tell the player they can move again if another attack is available', () => {
//         // Withdraw vertical
//         const boardPositionsBeforeVerticalWithdrawal: string = '00200'+ '00200' + '00100' + '02000' + emptyRow5;
//         const board = new Board(5, 5, boardPositionsBeforeVerticalWithdrawal);

//         // DO WITHDRAWAL
//         const canMoveAgain = board.performMove(12, Direction.DOWN);
//         expect(canMoveAgain).to.equal(true);

//         const boardPositionsAfterVerticalWithdrawal: string = emptyRow5 + emptyRow5 + emptyRow5 + '02100' + emptyRow5;
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterVerticalWithdrawal);
//         expect(board.getWinner()).to.be.equal(Winner.NONE);
//     });
    
//     it('should not allow the player to move again if that move would return them to their previous position', () => {
//         // Approach diagonal
//         const boardPositionsBeforeDiagonalApproach: string = '2000002000' + '00100' + emptyRow5 + '00002';
//         const board = new Board(5, 5, boardPositionsBeforeDiagonalApproach);

//         // Do approach
//         const canMoveAgain = board.performMove(12, Direction.DOWNRIGHT);
//         expect(canMoveAgain).to.equal(false);

//         const boardPositionsAfterDiagonalApproach: string = '2000002000' + emptyRow5 + '00010' + emptyRow5;
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterDiagonalApproach);
//         expect(board.getWinner()).to.be.equal(Winner.NONE);
//     });
    
//     it('should not allow the player to move in the same direction twice', () => {
//         // Withdraw diagonal
//         const boardPositionsBeforeDiagonalWithdrawal: string = '2000001000' + emptyRow5 + emptyRow5 + '00002';
//         const board = new Board(5, 5, boardPositionsBeforeDiagonalWithdrawal);

//         // Do withdrawal
//         const canMoveAgain = board.performMove(6, Direction.DOWNRIGHT);
//         // Even tho an attack is possible, it shouldnt let you do it because that attack would be in the same direction as the first attack.
//         expect(canMoveAgain).to.equal(false);

//         const boardPositionsAfterDiagonalWithdrawal: string = emptyRow5 + emptyRow5 + '00100' + emptyRow5 + '00002';
//         expect(board.getBoardPositionsAsString()).to.equal(boardPositionsAfterDiagonalWithdrawal);
//         expect(board.getWinner()).to.be.equal(Winner.NONE);
//     });    
// });
