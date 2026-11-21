/**
 * Highlighting on the grid of buttons over the board, shared by the game and tutorial pages.
 */

export function highlightPossibleMoves(possibleMoves: number[]) {
    const buttons = document.querySelectorAll('.grid-container button');

    // Display all possible moves
    for (let i = 0; i < possibleMoves.length; i++) {
        const button = buttons[possibleMoves[i]];
        if (button) {
            button.classList.add('possibleMove');
        }
    }
}

export function highlightMoveablePieces(moveablePieces: number[]) {
    const buttons = document.querySelectorAll('.grid-container button');

    // Display all moveable pieces
    for (let i = 0; i < moveablePieces.length; i++) {
        const button = buttons[moveablePieces[i]];
        if (button) {
            button.classList.add('moveablePiece');
        }
    }
}

export function highlightApproachOrWithdrawPieces(highlightApproachOrWithdrawPieces: number[]) {
    const buttons = document.querySelectorAll('.grid-container button');

    // Display the two pieces that players can choose to attack
    for (let i = 0; i < highlightApproachOrWithdrawPieces.length; i++) {
        const button = buttons[highlightApproachOrWithdrawPieces[i]];
        if (button) {
            button.classList.add('approachOrWithdraw');
        }
    }
}

export function removeAllHighlighting() {
    const buttonsWithMoveablePiece = document.querySelectorAll('.grid-container button.moveablePiece');
    buttonsWithMoveablePiece.forEach(button => {
        button.classList.remove('moveablePiece');
    });
    const possibleMoves = document.querySelectorAll('.grid-container button.possibleMove');
    possibleMoves.forEach(button => {
        button.classList.remove('possibleMove');
    });
    const approachOrWithdrawPieces = document.querySelectorAll('.grid-container button.approachOrWithdraw');
    approachOrWithdrawPieces.forEach(button => {
        button.classList.remove('approachOrWithdraw');
    });
}
