# Web101 Fil Rouge

Prototype statique de l'application de conversations. Les interfaces sont actuellement réalisées uniquement en HTML et CSS ; la logique JavaScript et PHP sera ajoutée ultérieurement.

## Structure

```text
.
├── config/
├── public/
│   ├── index.html
│   ├── conversation.html
│   ├── contact.html
│   ├── parametre.html
│   ├── css/
│   │   ├── base.css
│   │   ├── index.css
│   │   ├── conversation.css
│   │   ├── contact.css
│   │   └── parametre.css
├── .env.example
└── composer.json
```

## Lancer le projet

Depuis la racine du projet :

```bash
php -S localhost:8000 -t public
```

Puis ouvrir <http://localhost:8000>.

Les formulaires, les conversations et les actions de contacts sont pour le moment des éléments statiques de démonstration. La connexion, la persistance des messages, les contacts et la gestion du compte seront connectées au backend PHP dans une prochaine étape. Les comportements JavaScript seront également ajoutés ultérieurement.
