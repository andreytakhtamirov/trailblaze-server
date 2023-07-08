const {
    kMinUsernameLength,
    kMaxUsernameLength,
    kUsernameRegex,
    kBannedCharacters,
} = require('../constants/input');

function isUsernameValid(username) {
    if (username === null || username === undefined) {
        return false;
    }

    // Minimum and maximum length.
    if (username.length < kMinUsernameLength) {
        return false;
    } else if (username.length > kMaxUsernameLength) {
        return false;
    }

    // Allowed characters (alphanumeric and underscore).
    if (!(kUsernameRegex).test(username)) {
        return false;
    }

    // No spaces.
    if (username.includes(kBannedCharacters)) {
        return false;
    }

    return true;
}

module.exports = isUsernameValid;