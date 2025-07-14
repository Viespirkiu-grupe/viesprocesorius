# Viešprocesorius

Nedidelė programa skirta ištraukti tekstą iš PDF failų.

Jeigu puslapis turi bent 32 simbolius – naudojamas puslapio tekstas, jeigu ne – Tesseract OCR (ant WASM).

## Naudojimas

### Testavimas

```bash
node . test.pdf
```

```bash
node . https://example.com/test.pdf
```