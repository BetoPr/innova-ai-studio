// Listas compartilhadas (galeria, compartilhar, detalhe).
// Os values precisam bater com os check constraints do banco
// (migration 004_prompt_hub_and_billing).

export const CATEGORIES = [
  ['realista','Realista'], ['cinematografico','Cinematográfico'], ['anime','Anime'],
  ['arquitetura','Arquitetura'], ['cartoon','Cartoon'], ['3d','3D'], ['vetor','Vetor'],
  ['aquarela','Aquarela'], ['esboco','Esboço'], ['pintura-oleo','Pintura a óleo'],
  ['abstrato','Abstrato'], ['surreal','Surreal'], ['moda','Moda'], ['fotografia','Fotografia'],
  ['retrato','Retrato'], ['corporativo','Corporativo'], ['minimalista','Minimalista'],
  ['moderno','Moderno'], ['produto','Produto'], ['logo','Logo'], ['infografico','Infográfico'],
  ['fantasia','Fantasia'], ['ficcao-cientifica','Ficção científica'], ['cyberpunk','Cyberpunk'],
  ['retro-vintage','Retrô/Vintage'], ['grunge','Grunge'],
];

export const MODELS = [
  ['gemini','Gemini'], ['midjourney','Midjourney'], ['flow','Flow'],
  ['dalle','DALL·E'], ['stable-diffusion','Stable Diffusion'], ['flux','Flux'], ['outro','Outro'],
];

export const TONES = [
  ['vibrante','Vibrante'], ['escuro-atmosferico','Escuro/Atmosférico'], ['elegante','Elegante'],
];

export const LANGS = [
  ['pt','Português'], ['en','English'], ['es','Español'], ['fr','Français'], ['ar','العربية'],
];

export const ASPECTS = [
  ['1:1','Quadrado 1:1'], ['4:5','Vertical 4:5'], ['9:16','Stories 9:16'],
  ['3:4','Retrato 3:4'], ['16:9','Wide 16:9'], ['4:3','Clássico 4:3'],
];

export const EXTRAS = [
  ['glitch','Glitch'], ['neon','Neon'], ['design-plano','Design plano'],
  ['hdr','HDR'], ['grain','Grain'], ['bokeh','Bokeh'],
  ['monocromatico','Monocromático'], ['pastel','Pastel'], ['vibracao-alta','Saturação alta'],
];

export const FREE_PUBLISH_LIMIT = 5;
