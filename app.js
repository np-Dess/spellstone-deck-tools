var base64chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!~',
  runeDelimiter = '/',
  indexDelimiter = '-',
  priorityDelimiter = '|',
  noFusionInHash = {};
for (var id in CARDS) {
  if (id < 1e4)
    (!(fusion = FUSIONS[id]) || Number(fusion) < 1e4) &&
      (noFusionInHash[id] = !0);
}
var maxRuneID = 1e3;

function loadCard(id) {
  return CARDS[id];
}

function is_commander(id) {
  var card = loadCard(id);
  return card && '1' == card.card_type;
}

function makeUnitInfo(id, level, runes) {
  var unit = {
    id: Number(id),
    level: Number(level),
    runes: [],
  };
  return runes && (unit.runes = runes), unit;
}

const elariaCaptain = makeUnitInfo(202, 1);

function cleanCardName(name) {
  return name.replace(/[^a-zA-Z0-9]$/, '');
}

function getCardName(unitId) {
  const nameArr = CARDS[unitId].name.split(' ');
  let name = CARDS[unitId] ? cleanCardName(nameArr[0]) : 'Unknown';
  if (name === 'The' || name === 'Uncommon') {
    name = CARDS[unitId].name;
  }
  return name;
}

function decimal_to_base64(dec, len) {
  for (var base64 = '', i = 0; i < len; i++) {
    var part = dec % 64;
    (base64 += base64chars[part]), (dec = (dec - part) / 64);
  }
  return base64;
}

function base64_to_decimal(base64) {
  for (var dec = 0, i = base64.length - 1; 0 <= i; i--) {
    (dec *= 64), (dec += base64chars.indexOf(base64[i]));
  }
  return dec;
}

function runeID_to_decimal(runeID) {
  if (0 == runeID) return 0;
  var runeLevel = (runeID = parseInt(runeID) % 5e3) % 10,
    runeType = (runeID - runeLevel) / 10;
  return (runeID = runeID = 5 * runeType + runeLevel - 1);
}

function base64_to_runeID(base64) {
  return decimal_to_runeID(
    base64chars.indexOf(base64[0]) + 64 * base64chars.indexOf(base64[1])
  );
}

function decimal_to_runeID(decimal) {
  var runeLevel = decimal % 5,
    runeType = (decimal - runeLevel) / 5;
  return 0 == runeType ? 0 : 10 * runeType + runeLevel + 5001;
}

function numberToBase64(decimal) {
  return base64chars[Math.floor(decimal / 64)] + base64chars[decimal % 64];
}

function base64ToNumber(base64) {
  return 64 * base64chars.indexOf(base64[0]) + base64chars.indexOf(base64[1]);
}

function unitInfo_format_to_sim(unit_info) {
  const { unit_id, ...restUnitInfo } = unit_info;
  const newUnitInfo = {
    id: unit_id,
    ...restUnitInfo,
  };
  if (newUnitInfo?.runes?.length) {
    const { item_id, ...restRuneInfo } = newUnitInfo.runes[0];
    return {
      ...newUnitInfo,
      runes: [
        {
          id: item_id,
          ...restRuneInfo,
        },
      ],
    };
  }
  return newUnitInfo;
}

const unitInfo_to_textual = (unit_info, isCommander = false) => {
  let name = getCardName(unit_info?.id);
  const runeId = unit_info?.runes[0]?.id;
  const rune = runeId ? RUNES[runeId]?.name?.split(' ').pop() || '' : '';
  const level = noFusionInHash[parseInt(unit_info?.id)]
    ? `|${unit_info?.level}`
    : '';

  return isCommander ? `${name}` : `${name}${level}${rune ? `|${rune}` : ''}`;
};

function unitInfo_to_base64(unit_info) {
  var baseID = parseInt(unit_info.id),
    level = parseInt(unit_info.level) - 1;
  if (noFusionInHash[baseID]) {
    var fusion = Math.floor(level / 7);
    level = level % 7;
  } else {
    fusion = Math.floor(baseID / 1e4);
    baseID %= 1e4;
  }
  var runeID = 0;
  unit_info?.runes?.length &&
    ((runeID = parseInt(unit_info.runes[0].id)), (runeID %= 5e3));
  unit_info.priority;
  var dec = baseID;
  return decimal_to_base64(
    (dec = (dec = 7 * (dec = 3 * dec + fusion) + level) * maxRuneID + runeID),
    5
  );
}

function base64_to_unitInfo(base64) {
  var dec = base64_to_decimal(base64),
    runeID = dec % maxRuneID,
    level = (dec = (dec - runeID) / maxRuneID) % 7,
    fusion = (dec = (dec - level++) / 7) % 3,
    unitID = (dec = (dec - fusion) / 3);
  noFusionInHash[unitID]
    ? (level += 7 * fusion)
    : 0 < fusion && (unitID = Number(fusion + '' + unitID));
  var unit_info = makeUnitInfo(unitID, level);
  return (
    0 < runeID &&
      unit_info.runes.push({
        id: 5e3 + runeID,
      }),
    unit_info
  );
}

function hash_encode(deck) {
  let current_hash = [],
    has_priorities = !1,
    has_indexes = !1,
    indexes = [];

  for (let k in (deck.commander &&
    current_hash.push(
      unitInfo_to_base64(unitInfo_format_to_sim(deck.commander))
    ),
  deck.deck)) {
    (current_card = deck.deck[k])?.priority && (has_priorities = !0),
      current_card?.index &&
        (indexes.push(numberToBase64(current_card.index)), (has_indexes = !0)),
      current_hash.push(
        unitInfo_to_base64(unitInfo_format_to_sim(current_card))
      );
  }

  if (has_priorities) {
    let priorities = priorityDelimiter;
    for (let k in deck.deck) {
      let current_card;
      (current_card = deck.deck[k]).priority
        ? (priorities += current_card.priority)
        : (priorities += '0');
    }
    current_hash.push(priorities);
  }

  return (
    has_indexes &&
      ((indexes = indexDelimiter + indexes.join('')),
      current_hash.push(indexes)),
    (current_hash = current_hash.join(''))
  );
}

function hash_decode(hash) {
  var unitInfo,
    indexes,
    current_deck = {
      deck: [],
    };
  0 < hash.indexOf(indexDelimiter) &&
    ((indexes = hash.substr(hash.indexOf(indexDelimiter) + 1).match(/.{1,2}/g)),
    (hash = hash.substr(0, hash.indexOf(indexDelimiter))));
  for (var unitidx = 0, i = 0; i < hash.length; i += 5) {
    var unitHash = hash.substr(i, 5);
    (unitInfo = base64_to_unitInfo(unitHash)),
      0 < unitidx &&
        indexes &&
        (unitInfo.index = base64ToNumber(indexes[unitidx - 1])),
      unitInfo &&
        (loadCard(unitInfo.id)
          ? (!current_deck.commander && is_commander(unitInfo.id)
              ? (current_deck.commander = unitInfo)
              : current_deck.deck.push(unitInfo),
            unitidx++)
          : console.log(
              "Could not decode '" + unitHash + "' (" + unitInfo.id + ')'
            ));
  }
  return (
    current_deck.commander || (current_deck.commander = elariaCaptain),
    current_deck
  );
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

const jsonInputHTML = document.getElementById('jsonInput');
const playerNameHTML = document.getElementById('playerName');
const outputHTML = document.getElementById('output');
const textDeckHTML = document.getElementById('textDeck');
const deckInputHTML = document.getElementById('deckInput');
const decodedOutputHTML = document.getElementById('decodedOutput');

const decodeHashBtnHTML = document.getElementById('decodeButton');
const extractBtnHTML = document.getElementById('extractButton');
const clearBtnHTML = document.getElementById('clearButton');

const copyPlayerBtnHTML = document.getElementById('copyPlayer');
const copyHashBtnHTML = document.getElementById('copyHash');
const copyCardsBtnHTML = document.getElementById('copyCards');
const copyDecodedCardsBtnHTML = document.getElementById('copyDecodedCards');

decodeHashBtnHTML.addEventListener('click', function () {
  const input = deckInputHTML.value.trim();
  if (!input) {
    decodedOutputHTML.textContent = 'Please enter a valid encoded deck string';
    return;
  }
  try {
    const decodedDeck = hash_decode(input);
    const commanderTextual = unitInfo_to_textual(decodedDeck.commander, true);
    let cardNamesArr = [];
    for (card of decodedDeck.deck) {
      cardNamesArr.push(`${unitInfo_to_textual(card)}`);
    }
    const deckTextual = `${commanderTextual}: ${cardNamesArr.join(', ')}`;
    decodedOutputHTML.textContent = deckTextual;
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

extractBtnHTML.addEventListener('click', function () {
  const input = jsonInputHTML.value;

  try {
    const json = JSON.parse(input);
    const cardMap = json?.battle_data?.card_map;
    const commanderData = json?.battle_data?.defend_commander;
    const playerName = json?.battle_data?.enemy_name;
    if (!cardMap || !commanderData)
      throw new Error('card_map or commander not found in JSON');

    playerNameHTML.value = playerName || 'Unknown Player';

    const deckWithoutCommander = {};

    for (let i = 101; i <= 115; i++) {
      if (cardMap[i]) {
        deckWithoutCommander[i] = {
          ...cardMap[i],
          runes: Object.values(cardMap[i].runes),
        };
      }
    }

    const deckData = {
      deck: {
        ...deckWithoutCommander,
      },
      commander: {
        ...commanderData,
      },
    };

    const encodedDeck = hash_encode(deckData);
    console.log('encodedDeck', encodedDeck);

    outputHTML.value = encodedDeck;

    let textDeck = `${getCardName(commanderData.unit_id)}:`;
    const cardTexts = Object.values(deckWithoutCommander).map((card) => {
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
