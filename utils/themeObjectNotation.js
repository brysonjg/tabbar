const thone = {
    parse(str) {
        if (typeof str !== "string") throw new Error("Input must be string");

        str = str
            .replace(/\/\/.*$/gm, "")       // // comments
            .replace(/\\\*(.*)\*\\/gm, "")  // /* */ comments
            .replace(/\<(.*)\>/gm, "")  // <...> type tags

        str = str.replace(/,\s*([}\]])/g, "$1");

        str = str.replace(
            /\'/g,
            '"'
        );

        str = str.replace(
            /([a-zA-Z0-9_]+)\s*:/g,
            '"$1":'
        );

        str = str.replace(
            /:\s*([a-zA-Z_][a-zA-Z0-9_]*)/g,
            ':"$1"'
        );

        return JSON.parse(str);
    }
};
