import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType } from '../src/types.js';
import { applyOpening, generateOpenings } from '../src/ai/openings.js';

describe('Opening tests', () => {
    it('should generate the same distinct, balanced openings for the same seed', () => {
        const openings = generateOpenings(20, 4, 7);
        expect(openings.length).to.equal(20);
        expect(JSON.stringify(generateOpenings(20, 4, 7))).to.equal(JSON.stringify(openings));
        const positions = new Set<string>();
        for (const opening of openings) {
            expect(opening.length).to.equal(4);
            const board = new Board();
            applyOpening(board, opening);
            positions.add(board.getBoardPositionsAsString());
            expect(Math.abs(board.getNumPieces(PieceType.WHITE) - board.getNumPieces(PieceType.BLACK))).to.be.at.most(2);
        }
        expect(positions.size).to.equal(20);
    });

    it('should reject an odd number of opening turns', () => {
        expect(() => generateOpenings(5, 3)).to.throw('even');
    });
});
