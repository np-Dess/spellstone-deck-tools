const base64chars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~!';

function decimalToBase64(dec, length = 5) {
  let base64Str = '';
  for (let i = 0; i < length; i++) {
    base64Str = base64chars[dec % 64] + base64Str;
    dec = Math.floor(dec / 64);
  }
  return base64Str.split('').reverse().join('');
}

function base64ToDecimal(base64) {
  let dec = 0;
  for (let i = base64.length - 1; i >= 0; i--) {
    dec *= 64;
    dec += base64chars.indexOf(base64[i]);
  }
  return dec;
}

function encodeCard(unitInfo) {
  const baseId = parseInt(unitInfo.unit_id, 10);
  const level = parseInt(unitInfo.level, 10) - 1;
  const runeId =
    unitInfo.runes && unitInfo.runes['1']
      ? parseInt(unitInfo.runes['1'].item_id, 10) % 5000
      : 0;

  let dec = baseId;
  dec = dec * 3 + 0;
  dec = dec * 7 + level;
  dec = dec * 1000 + runeId;

  return decimalToBase64(dec, 5);
}

function encodeDeck(deckInfo) {
  return Object.values(deckInfo).map(encodeCard).join('');
}

function cleanCardName(name) {
  return name.replace(/[^a-zA-Z0-9]$/, '');
}

function getCardName(unitId) {
  return CARDS[unitId]
    ? cleanCardName(CARDS[unitId].name.split(' ')[0])
    : 'Unknown';
}

function getRuneName(runeId) {
  return RUNES[runeId] ? RUNES[runeId].name.split(' ').pop() : '';
}

function decodeDeck(encodedString) {
  const cardLength = 5;
  const numCards = encodedString.length / cardLength;
  let decodedDeck = [];

  for (let i = 0; i < numCards; i++) {
    const cardCode = encodedString.substring(
      i * cardLength,
      (i + 1) * cardLength
    );
    const decodedCard = decodeCard(cardCode, i === 0);
    if (decodedCard) decodedDeck.push(decodedCard);
  }

  if (decodedDeck.length > 1) {
    return decodedDeck[0] + ': ' + decodedDeck.slice(1).join(', ');
  }

  return decodedDeck.join(' ');
}

function decodeCard(encodedCard, isCommander = false) {
  const dec = base64ToDecimal(encodedCard);
  const runeID = dec % 1000;
  let tempDec = (dec - runeID) / 1000;
  let level = (tempDec % 7) + 1;
  tempDec = (tempDec - level + 1) / 7;
  let fusion = tempDec % 3;
  let unitID = (tempDec - fusion) / 3;

  if (fusion === 1) {
    level += 7 * fusion;
  } else if (fusion > 0) {
    unitID = fusion * 10000 + unitID;
  }

  const name =
    CARDS[unitID]?.name?.split(' ')[0]?.replace(/[^a-zA-Z0-9]$/, '') ||
    'Unknown';
  const rune = runeID ? RUNES[5000 + runeID]?.name?.split(' ').pop() || '' : '';

  return isCommander ? `${name}` : `${name}|${level}${rune ? '|' + rune : ''}`;
}

function copyToClipboard(BtnTag, CopiedContent) {
  navigator.clipboard.writeText(CopiedContent).then(() => {
    const originalHTML = BtnTag.innerHTML;
    BtnTag.innerHTML = `<span id="success-icon">
            <svg
              class="w-4 h-4 text-white"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 16 12"
            >
              <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M1 5.917 5.724 10.5 15 1.5"
              />
            </svg>
          </span>`;

    setTimeout(() => {
      BtnTag.innerHTML = originalHTML;
    }, 1000);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const jsonInputHTML = document.getElementById('jsonInput');
  const playerNameHTML = document.getElementById('playerName');
  const outputHTML = document.getElementById('output');
  const textDeckHTML = document.getElementById('textDeck');

  const deckInputHTML = document.getElementById('deckInput');
  const decodedOutputHTML = document.getElementById('decodedOutput');

  const clearBtnHTML = document.getElementById('clearButton');

  const copyPlayerBtnHTML = document.getElementById('copyPlayer');
  const copyHashBtnHTML = document.getElementById('copyHash');
  const copyCardsBtnHTML = document.getElementById('copyCards');
  const copyDecodedCardsBtnHTML = document.getElementById('copyDecodedCards');

  document
    .getElementById('decodeButton')
    .addEventListener('click', function () {
      const input = deckInputHTML.value.trim();
      if (!input) {
        decodedOutputHTML.textContent =
          'Please enter a valid encoded deck string';
        return;
      }

      try {
        const decodedDeck = decodeDeck(input);
        decodedOutputHTML.textContent = decodedDeck;
      } catch (error) {
        decodedOutputHTML.textContent = 'Error: ' + error.message;
      }
    });

  clearBtnHTML.addEventListener('click', () => {
    playerNameHTML.value = '';
    jsonInputHTML.value = '';
    outputHTML.value = '';
    deckInputHTML.value = '';

    decodedOutputHTML.textContent = '';
    textDeckHTML.textContent = '';
  });

  document
    .getElementById('extractButton')
    .addEventListener('click', function () {
      const input = jsonInputHTML.value;

      try {
        const json = JSON.parse(input);
        const cardMap = json?.battle_data?.card_map;
        const commanderData = json?.battle_data?.defend_commander;
        const playerName = json?.battle_data?.enemy_name;
        if (!cardMap || !commanderData)
          throw new Error('card_map or commander not found in JSON');

        playerNameHTML.value = playerName || 'Unknown Player';

        const opponentDeck = {};
        for (let i = 101; i <= 115; i++) {
          if (cardMap[i]) {
            opponentDeck[i] = cardMap[i];
          }
        }

        const commanderCard = {
          unit_id: commanderData.unit_id,
          level: commanderData.level,
          runes: {},
        };

        const encodedCommander = encodeCard(commanderCard);
        const encodedDeck = encodedCommander + encodeDeck(opponentDeck);
        outputHTML.value = encodedDeck;

        let textDeck = `${getCardName(commanderCard.unit_id)}:`;
        const cardTexts = Object.values(opponentDeck).map((card) => {
          const name = getCardName(card.unit_id);
          const level = card.level;
          const rune =
            card.runes && card.runes['1']
              ? getRuneName(card.runes['1'].item_id)
              : '';
          return `${name}|${level}${rune ? '|' + rune : ''}`;
        });

        textDeck += ' ' + cardTexts.join(', ');
        textDeckHTML.textContent = textDeck;
      } catch (error) {
        outputHTML.value = 'Error: ' + error.message;
      }
    });

  copyPlayerBtnHTML.addEventListener('click', () => {
    copyToClipboard(copyPlayerBtnHTML, playerNameHTML.value);
  });
  copyHashBtnHTML.addEventListener('click', () => {
    copyToClipboard(copyHashBtnHTML, outputHTML.value);
  });
  copyCardsBtnHTML.addEventListener('click', () => {
    copyToClipboard(copyCardsBtnHTML, textDeckHTML.textContent);
  });
  copyDecodedCardsBtnHTML.addEventListener('click', () => {
    copyToClipboard(copyDecodedCardsBtnHTML, decodedOutputHTML.textContent);
  });
});
