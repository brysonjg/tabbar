#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char *replace_all(const char *src, const char *old, const char *new)
{
    size_t src_len = strlen(src);
    size_t old_len = strlen(old);
    size_t new_len = strlen(new);

    size_t count = 0;
    const char *p = src;
    while ((p = strstr(p, old))) {
        count++;
        p += old_len;
    }

    size_t out_len = src_len + count * (new_len - old_len) + 1;
    char *out = malloc(out_len);
    if (!out) return NULL;

    const char *s = src;
    char *d = out;

    while ((p = strstr(s, old))) {
        size_t n = (size_t)(p - s);
        memcpy(d, s, n);
        d += n;

        memcpy(d, new, new_len);
        d += new_len;

        s = p + old_len;
    }

    strcpy(d, s);
    return out;
}

static void print_usage(const char *prog)
{
    fprintf(stderr,
        "\n"
        "Usage:\n"
        "  %s fg bg tabc acbar fname\n\n"
        "Description:\n"
        "  Generates a themed SVG asset from a template file named '.temp'.\n"
        "  The program replaces color placeholders and known hard-coded\n"
        "  hex values in the template, then writes the resulting SVG\n"
        "  into the '../theme_imgs/' directory.\n\n"
        "Arguments:\n"
        "  fg      Foreground color (e.g. #ffffff)\n"
        "  bg      Background color (e.g. #1e1e1e)\n"
        "  tabc    Tab color\n"
        "  acbar   Active tab / accent bar color\n"
        "      (the top color of the active tab when the window is focused)\n"
        "      (if unwanted, set equal to bg)\n"
        "  fname   Output filename (e.g. theme.svg)\n\n"
        "Template substitutions:\n"
        "  for the security of the prosses, pleas do not use inputs that fit the regex \\{.*}\\gm\n\n"
        "Example:\n"
        "  %s #cdd6f4 #1e1e2e #313244 #89b4fa preview.svg\n\n",
        prog, prog
    );
}

int main(int argc, char **argv)
{
    if (argc != 6 ||
        !strcmp(argv[1], "-h") ||
        !strcmp(argv[1], "--help")) {
        print_usage(argv[0]);
        return 1;
    }

    const char *fg    = argv[1];
    const char *bg    = argv[2];
    const char *tabc  = argv[3];
    const char *acbar = argv[4];
    const char *fname = argv[5];

    /* Read template file */
    FILE *in = fopen(".temp", "rb");
    if (!in) {
        perror("Failed to open .temp");
        return 1;
    }

    fseek(in, 0, SEEK_END);
    long size = ftell(in);
    rewind(in);

    char *content = malloc((size_t)size + 1);
    if (!content) {
        fclose(in);
        fprintf(stderr, "Out of memory\n");
        return 1;
    }

    fread(content, 1, (size_t)size, in);
    content[size] = '\0';
    fclose(in);

    /* Apply replacements */
    char *tmp;

    tmp = replace_all(content, "{fg}", fg);
    free(content);
    content = tmp;

    tmp = replace_all(content, "{bg}", bg);
    free(content);
    content = tmp;

    tmp = replace_all(content, "{acbarc}", acbar);
    free(content);
    content = tmp;

    tmp = replace_all(content, "{tabc}", tabc);
    free(content);
    content = tmp;

    /* Write output file */
    char outpath[512];
    snprintf(outpath, sizeof(outpath),
             "../theme_imgs/%s", fname);

    FILE *out = fopen(outpath, "wb");
    if (!out) {
        perror("Failed to write output file");
        free(content);
        return 1;
    }

    fwrite(content, 1, strlen(content), out);
    fclose(out);
    free(content);

    return 0;
}
