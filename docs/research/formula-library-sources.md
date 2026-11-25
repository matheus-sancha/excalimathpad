Research for issue #350, 2026-11-25.

# Formula library: which sources to cite, and what may be reproduced

Question: the app plans a built-in library of mechanical design formulas, each
entry citing a source and tested against a worked example. Which references
suit a citation? What may be reproduced from them (the formula, symbol names, a
worked example's numbers, a table of formulas, a section figure) under US law,
Brazil's Lei 9.610/98 and EU law? Can an open-licensed collection seed the set,
and on what terms next to the repo's MIT licence? What do comparable open
projects do?

This note is not legal advice; it is an engineer's reading of the sources, to
be checked by a lawyer before anything turns on it.

## How far each claim was checked

The session's network blocked the statute and publisher sites themselves
(`copyright.gov`, `law.cornell.edu`, `planalto.gov.br`, `supreme.justia.com`,
`eur-lex.europa.eu`, `wipo.int`, `creativecommons.org`, `openstax.org`,
`en.wikipedia.org`, `ntrs.nasa.gov` all failed to resolve). Only
`raw.githubusercontent.com` and `pypi.org` could be fetched. Each claim below
carries one of three marks:

- **[fetched]**: I downloaded the file and read it.
- **[search]**: a web search returned the wording as an excerpt of the linked
  primary page. I did not open the page. Treat it as likely right and re-read
  the link before relying on the exact words.
- **[unverified]**: from memory. Not checked in this session.

## Answer

- **A formula is not protected by copyright in any of the three systems.** Write
  every formula ourselves, in our own notation and layout, and cite where it is
  documented. This is the settled reading of 17 U.S.C. § 102(b), Lei 9.610/98
  art. 8 I with art. 7 § 3, and TRIPS art. 9(2).
- **Cite freely, copy nothing but the mathematics.** A citation (author, title,
  edition, section or table number) needs no permission anywhere. So every source
  the issue lists is fit to *cite*. What differs is what may be *copied*.
- **Copy from none of the commercial textbooks or standards.** Their text,
  figures, table layouts and worked-example write-ups are protected, and the
  publishers and standards bodies all require written permission (VDI charges a
  fee for use in software).
- **Draw every figure ourselves.** Do not copy, trace or closely imitate a
  book's figure. A plain I-section or a simply supported beam drawn from the
  geometry is ours.
- **Write our own worked examples.** Use our own numbers, and get the expected
  value by an independent route (hand derivation, numerical integration). A
  published example may be named as a cross-check ("agrees with Example 7-4 in
  [1]"), as `fluids` does.
- **Do not seed the set from an open-licensed collection.** Nothing found is
  both useful and MIT-compatible. Wikipedia is CC BY-SA 4.0, and OpenStax and
  the open strength-of-materials textbooks are now CC BY-NC-SA. Share-alike and
  non-commercial terms cannot be carried into an MIT repo. Since the formulas
  themselves are free, a seed would save typing, not rights. Build the set by
  hand and cite.
- **US government reports are the best open sources to copy from if we ever
  need to** (NASA, NIST, MIL-HDBK-5), but they are free of copyright only inside
  the United States, so the same "write it ourselves" rule applies to a
  worldwide app.
- **Comparable projects do exactly this:** MIT or Apache code, formulas written
  fresh, a citation per function down to the equation or table number, and
  doctests that reproduce a published example's result.

## Proposed rule for an entry

1. The formula, written in the app's own syntax and symbols.
2. `source`: one primary citation with a locator: author, title, edition, year,
   and section, equation or table number. Optionally a second, freely readable
   one (a NASA or NIST report, or a Wikipedia article as a pointer only).
3. No text, figure, table layout or example wording taken from the source.
4. A test whose expected value we derived ourselves. If it also matches a
   published example, say which one.
5. A figure, if any, drawn in the repo from scratch.

For standards add the edition and clause ("EN 1993-1-1:2005, 6.3.1.2, Eq.
(6.49)") because the formula changes between editions.

## What the law says about a formula

### United States

- 17 U.S.C. § 102(b): "In no case does copyright protection for an original
  work of authorship extend to any idea, procedure, process, system, method of
  operation, concept, principle, or discovery, regardless of the form in which
  it is described, explained, illustrated, or embodied in such work."
  [[search] govinfo, USCODE-2024 title 17 § 102](https://www.govinfo.gov/content/pkg/USCODE-2024-title17/html/USCODE-2024-title17-chap1-sec102.htm)
- The Copyright Office says so for mathematics in plain words: "Ideas, methods,
  systems, mathematical principles, formulas, and equations are not
  copyrightable, and the same is true of devices based on them."
  [[search] Circular 33, Works Not Protected by Copyright](https://www.copyright.gov/circs/circ33.pdf).
  The search tool could not confirm that the current revision keeps this
  wording. Circular 31 lists "mathematical principles; formulas, algorithms"
  among what copyright does not protect, and adds that copyright does cover a
  particular description, explanation or illustration of an idea or system
  [[search] Circular 31](https://www.copyright.gov/circs/circ31.pdf).
- *Baker v. Selden*, 101 U.S. 99 (1879): copyright in a book that explains a
  book-keeping system gives no exclusive right in the system. "Where the truths
  of a science or the methods of an art are the common property of the whole
  world, any author has the right to express the one, or explain and use the
  other."
  [[search] govinfo, U.S. Reports vol. 101 p. 99](https://www.govinfo.gov/content/pkg/USREPORTS-101/pdf/USREPORTS-101-99.pdf)
- *Feist Publications v. Rural Telephone Service*, 499 U.S. 340 (1991): facts
  are not copyrightable, effort alone earns nothing ("Copyright rewards
  originality, not effort"), and a compilation is protected only in an original
  selection, coordination or arrangement, never in the facts themselves.
  [[search] govinfo, U.S. Reports vol. 499 p. 340](https://www.govinfo.gov/content/pkg/USREPORTS-499/pdf/USREPORTS-499-340.pdf)

### Brazil (Lei 9.610/98)

- Art. 8: "Não são objeto de proteção como direitos autorais de que trata esta
  Lei: I - as idéias, procedimentos normativos, sistemas, métodos, projetos ou
  conceitos matemáticos como tais". The same article excludes (V) "as
  informações de uso comum tais como calendários, agendas, cadastros ou
  legendas" and (VI) "os nomes e títulos isolados".
  [[search] Planalto, Lei 9.610](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm)
- Art. 7 § 3 is the most direct text for a formula library: "No domínio das
  ciências, a proteção recairá sobre a forma literária ou artística, não
  abrangendo o seu conteúdo científico ou técnico". The book's wording and
  drawings are protected. The engineering content is not.
  [[search] same law, art. 7](https://www.planalto.gov.br/ccivil_03/leis/l9610.htm)
- Art. 7 XIII protects collections, compilations and databases that "por sua
  seleção, organização ou disposição de seu conteúdo, constituam uma criação
  intelectual", and § 2 says that protection does not reach the data or
  materials themselves.
  [[search] Câmara dos Deputados, consolidated text](https://www2.camara.leg.br/legin/fed/lei/1998/lei-9610-19-fevereiro-1998-365399-normaatualizada-pl.html)
- Art. 46 III allows quoting passages of any work for study, criticism or
  debate, naming the author and the source, and art. 46 VIII allows small
  excerpts of earlier works inside a new work under conditions. The search
  confirmed that both items exist and their gist, not their full text
  [[search] gov.br PDF of the law](https://www.gov.br/turismo/pt-br/secretaria-especial-da-cultura/assuntos/direitos-autorais/legislacao-de-direitos-autorais/pdfs/nacional/lei-no-9-610-de-19-de-fevereiro-de-1998.pdf).
  The rule above does not lean on either exception.
- No Brazilian court decision on formulas or on ABNT standards was checked.
  [unverified]

### European Union and the treaties

- TRIPS art. 9(2), which binds the US, Brazil and every EU state: "Copyright
  protection shall extend to expressions and not to ideas, procedures, methods
  of operation or mathematical concepts as such."
  [[search] WTO, TRIPS Part II](https://www.wto.org/english/docs_e/legal_e/27-trips_04_e.htm).
  The WIPO Copyright Treaty art. 2 says the same. [unverified]
- A database is protected by copyright only where "the selection or arrangement
  of [its] contents constitute the author's own intellectual creation"
  (Directive 96/9/EC art. 3).
  [[search] EUR-Lex, Directive 96/9/EC](https://eur-lex.europa.eu/eli/dir/1996/9/oj/eng)
- **The EU has one thing the US and Brazil do not: the sui generis database
  right** (same directive, art. 7). It protects a substantial investment in
  obtaining, verifying or presenting a database's contents against extraction
  of a substantial part, with no creativity needed
  [[search] EUR-Lex summary](https://eur-lex.europa.eu/EN/legal-content/summary/legal-protection-databases.html).
  Art. 11 limits it to makers who are EU nationals or residents, or companies
  established in the EU, so a US publisher's handbook does not get it.
  [unverified] It is one more reason not to transcribe a European table of
  section properties or material values wholesale.
- *Infopaq* (C-5/08) sets the EU originality test, "the author's own
  intellectual creation", and found that even an 11-word extract can meet it.
  *SAS Institute v World Programming* (C-406/10) held that functionality is not
  protected. [unverified beyond the case names: [BAILII, C-5/08](https://www.bailii.org/eu/cases/EUECJ/2009/C508.html)]

## The five things the issue asks about

| Item | May we reproduce it? | Why |
| --- | --- | --- |
| The formula itself (`σ = M·c / I`, `P_cr = π²·E·I / (K·L)²`) | Yes | Excluded by § 102(b), art. 8 I and TRIPS 9(2), cited above |
| Symbol names (`I`, `σ`, `K_t`, `d_2`) | Yes | Single letters and conventions are not works. Brazil art. 8 VI excludes isolated names. The US Office does not register names and short phrases (37 CFR 202.1(a)) [unverified] |
| A worked example's numbers | The numbers yes, the write-up no | A result that follows from the formula is a fact. The problem statement and the worked solution text are expression. A book's inputs are the author's invention, not found facts, so copying many examples from one book also takes its selection |
| A table of formulas as a compilation | The individual formulas yes, the table as a whole no | *Feist*, art. 7 XIII and § 2, and Directive 96/9 art. 3 protect an original selection and arrangement. Copying Roark's Table 8.1 case by case, in order, with its layout, takes exactly that |
| A section figure | Redraw from scratch. Do not copy or trace | A drawing is a protected work in all three systems. What a figure shows (a rectangle of width `b` and height `h`) is an idea anyone may draw. Circular 31 puts the line in the same place: the idea is free, the particular illustration is not |

Two cautions on the middle rows:

- **Empirical constants and curve fits are facts, but a table of them may be a
  protected compilation,** and in the EU possibly a protected database. Stress
  concentration charts (Peterson), material allowables (MMPDS) and friction
  coefficients (VDI 2230 table A5) are the cases that will come up. Take a
  single value with a citation. Do not transcribe the table. [reasoning from the
  sources above, not a holding on these works]
- **Design-code formulas are still formulas.** A code's clause text, its
  commentary and its tables are the standards body's. The relation between the
  quantities is not.

## Sources, one by one

Every source here may be cited. The column that matters is the last.

| Source | Good for | Status | Copy from it? |
| --- | --- | --- | --- |
| Shigley's Mechanical Engineering Design (McGraw Hill) | Fasteners, shafts, fatigue, springs | Commercial | No. Written request to the McGraw Hill Permissions Department [[search]](https://www.mheducation.com/about-us/policy-center/permissions) |
| Roark's Formulas for Stress and Strain (McGraw Hill) | Beam, plate and shell cases, section properties | Commercial | No, same publisher. The tables are the classic "compilation" risk |
| Beer & Johnston, Mechanics of Materials (McGraw Hill) | Bending, shear, torsion, buckling | Commercial | No, same publisher |
| Hibbeler, Mechanics of Materials (Pearson) | Same | Commercial | No. Pearson says written permission is required and takes requests through its permissions form [[search]](https://www.pearson.com/global-permission-granting.html) |
| Eurocode 3 (EN 1993), CEN | Steel member checks, buckling curves | Copyright of CEN and its national members | No. "Any reproduction, distribution, resale or communication of standards in any medium, is forbidden without the formal written authorization from the national body where the standard was bought" [[search] CEN-CENELEC FAQ](https://cencenelec.eu/bottom-navigation-pages/faqs) |
| AISC 360 | Steel member checks (US) | Copyright AISC, PDF free to download | No. Free to read is not free to copy. AISC runs its own permission process [[search]](https://www.aisc.org/publications/copyright-permissions/), [[search] AISC 360 page](https://aisc.org/publications/steel-standards/aisc-360) |
| ISO standards (threads, fits, fastener classes) | Thread geometry, property classes | Copyright ISO, licensed not sold | No. "Any unauthorized use such as copying, scanning or distribution is prohibited" [[search] ISO copyright page](https://www.iso.org/copyright.html) |
| VDI 2230 | Bolted joints | Copyright VDI | No. VDI states its guidelines are protected and has a specific paid permission for use of their content in software, with a required credit line [[search] VDI, Verwertung von VDI-Richtlinien in Softwareprogrammen](https://vm-ausbildung.vdi.de/fileadmin/pages/vdi_de/redakteure/richtlinien/dateien/Verwertung_von_VDI_Richtlinien_in_Softwareprogrammen.pdf). Whether VDI would say that implementing a formula counts as "use of content" was not established |
| OpenStax | Statics, basic stress and strain | OpenStax's help pages now say its textbooks are CC BY-NC-SA 4.0. Older copies were CC BY 4.0 | No. Non-commercial and share-alike. See the next section [[search] OpenStax licensing help](https://help.openstax.org/s/article/Licensing-information-of-OpenStax-textbooks) |
| NIST publications | Units, constants, the SI | No US copyright for works by NIST staff (17 U.S.C. § 105). "may be subject to foreign copyright". Standard Reference Data is copyrighted | With care. Check for third-party material, and note the foreign-copyright caveat [[search] NIST statement](https://www.nist.gov/open/copyright-fair-use-and-licensing-statements-srd-data-software-and-technical-series-publications) |
| NASA technical reports (NTRS) | Fastener design, buckling of shells, structures manuals | "Documents available from this Web site are not protected by copyright unless noted". The repository also holds non-NASA and contractor material | With care, per report. Check the record's copyright field [[search] NASA STI disclaimers](https://sti.nasa.gov/disclaimers/) |
| MIL-HDBK-5J | Material allowables, joint data | US government handbook, cancelled and superseded by MMPDS | Probably, in the US. Its distribution statement and status were not confirmed in this session [unverified] |
| MMPDS | Current material allowables | Published by Battelle and sold through SAE | No. Treat as commercial [[search] SAE listing](https://saemobilus.sae.org/books/metallic-materials-properties-development-standardization-mmpds-handbook-2024-volume-b-992_volume1). Battelle's licence terms were not found |
| Wikipedia | A freely readable pointer | CC BY-SA 4.0 | No, share-alike. Also not a primary source: cite the book behind the article [[search] Creative Commons, Wikipedia moves to CC 4.0](https://creativecommons.org/2023/06/29/wikipedia-moves-to-cc-4-0-licenses/) |

On 17 U.S.C. § 105: "Copyright protection under this title is not available for
any work of the United States Government"
[[search] House, U.S. Code § 105](https://uscode.house.gov/us/usc/119-134/t17/s105/).
It covers works by federal employees in their official duties, not contractors,
and its legislative history says it is not meant to affect protection abroad
[[search] same page's notes; summary at Ohio State University Libraries](https://library.osu.edu/site/copyright/?p=511).
For a Brazilian author and a worldwide app, a NASA report is safe to copy in the
US and only probably safe elsewhere.

On standards made into law: the D.C. Circuit held in 2023 that posting
standards incorporated by reference into law, without charge, was fair use
(*ASTM v. Public.Resource.Org*, 82 F.4th 1262)
[[search] Copyright Office fair use summary](https://www.copyright.gov/fair-use/summaries/amsoc-publicresourceorg-dccirc2023.pdf).
The EU Court of Justice held in 2024 that harmonised standards form part of EU
law and must be open to access requests (C-588/21 P)
[[search] judgment](https://law.resource.org/pub/eu/docket/2024-03-05.CJEU%20Judgement.pdf),
and by one account did not rule on whether they are copyrightable
[[search] ABA Landslide](https://www.americanbar.org/groups/intellectual_property_law/resources/landslide/2026-summer/cracks-copyright-standards-referenced-eu-law).
Neither case licenses copying Eurocode 3 or AISC 360 text into an app. They
do not change the rule here.

### Which source to prefer per entry

| Entries | First citation | Freely readable second citation |
| --- | --- | --- |
| Second moments of area, section moduli, centroids | Roark, appendix A table, or Beer & Johnston | None needed. These are derivable, and the test can integrate numerically |
| Bending, transverse shear, torsion, combined stress, von Mises | Beer & Johnston or Hibbeler, by section | An open strength-of-materials text as a pointer |
| Beam deflection cases | Roark, table and case number | NASA structures manuals [unverified which] |
| Euler and Johnson buckling | Shigley or Beer & Johnston. Eurocode 3 and AISC 360 for code checks, by clause and edition | The AISC 360 PDF is free to read |
| Fasteners and bolted joints | Shigley ch. 8. VDI 2230 Part 1 for the systematic method | NASA-STD-5020 and NASA RP-1228 (Fastener Design Manual) [unverified: not checked in this session] |
| Shafts, keys, fatigue | Shigley, by equation number | None found |
| Material properties | Not a formula. Leave to the user, or cite MMPDS per value | MIL-HDBK-5J [unverified] |

## Can an open-licensed collection seed the set?

Not usefully, for two separate reasons.

**The licences found do not fit an MIT repo.**

- CC BY-SA 4.0 (Wikipedia). Section 3(b)(1): "The Adapter's License You apply
  must be a Creative Commons license with the same License Elements, this
  version or later, or a BY-SA Compatible License."
  [[fetched] CC BY-SA 4.0 legal code, SPDX copy](https://raw.githubusercontent.com/spdx/license-list-data/main/text/CC-BY-SA-4.0.txt).
  Creative Commons lists only the Free Art License 1.3 and GPLv3 as compatible
  with BY-SA 4.0, and GPLv3 one way only
  [[search] Creative Commons, compatible licenses](https://creativecommons.org/compatiblelicenses),
  [[search] CC announcement](https://creativecommons.org/2015/10/08/cc-by-sa-4-0-now-one-way-compatible-with-gplv3/).
  MIT is not on the list. A formula file adapted from Wikipedia would have to be
  BY-SA, not MIT.
- CC BY-NC-SA 4.0 (OpenStax now, and the open strength-of-materials texts found:
  [[search] LibreTexts, Strength of Materials](https://eng.libretexts.org/Bookshelves/Mechanical_Engineering/Strength_of_Materials),
  [[search] LibreTexts, Roylance](https://eng.libretexts.org/Bookshelves/Mechanical_Engineering/Mechanics_of_Materials_(Roylance))).
  The non-commercial term contradicts MIT's grant to "sell copies of the
  Software" ([`LICENSE`](../../LICENSE)), on top of the share-alike problem.
- CC BY 4.0 would work, with conditions. The licence is "non-sublicensable" and
  forbids "additional or different terms" on the material, so the seeded file
  stays CC BY inside the MIT repo, and we must keep the creator's name, a
  copyright notice, a licence notice, a link to the source, and say that we
  changed it (sections 2(a)(1), 2(a)(5)(B), 3(a)(1))
  [[fetched] CC BY 4.0 legal code, SPDX copy](https://raw.githubusercontent.com/spdx/license-list-data/main/text/CC-BY-4.0.txt).
  The repo's licence statement would become "MIT, except these files". One
  CC BY candidate turned up and was not checked: "Essential Mechanics – Statics
  and Strength of Materials"
  [[search] Open Textbook Library](https://open.umn.edu/opentextbooks/textbooks/1544).
- MIT, BSD and Apache-2.0 code libraries (next section) can be read and their
  formulas re-implemented. Porting their code brings their notice with it: MIT
  requires that "the above copyright notice and this permission notice shall be
  included in all copies or substantial portions"
  [[fetched] `fluids` licence](https://raw.githubusercontent.com/CalebBell/fluids/master/LICENSE.txt).

**The seed would give us nothing we lack.** The licence is needed only for the
protected parts: wording, figures, arrangement. We want none of those. Both CC
licences say so themselves: "where Exceptions and Limitations apply to Your use,
this Public License does not apply, and You do not need to comply with its terms
and conditions" (section 2(a)(2), [fetched], same files). Reading a formula in
Wikipedia and typing it into our own entry is not a licensed act. Copying
Wikipedia's "List of second moments of area" table with its pictures is.

## What comparable open projects do

- **`fluids` and `ht` (Caleb Bell, MIT).** Each function has a numpy-style
  `References` block with the full citation, including commercial textbooks
  (Cengel & Cimbala, McGraw Hill) and handbooks, and names the source in the
  function name (`K_gate_valve_Crane`, after Crane TP 410). The docstring example
  reproduces a published one by number and reports the difference: "Example 7-4
  in [1]_; a 150 by 100 mm class 600 steel gate valve [...] The calculated result
  is lower than their value of 1.22".
  [[fetched] `fluids/friction.py`](https://raw.githubusercontent.com/CalebBell/fluids/master/fluids/friction.py),
  [[fetched] `fluids/fittings.py`](https://raw.githubusercontent.com/CalebBell/fluids/master/fluids/fittings.py)
- **`structuralcodes` (fib International, Apache-2.0).** Implements Eurocode 2
  and the fib Model Code. Each function cites clause and equation: "EUROCODE 2
  1992-1-1:2004, Eq. (7.1)", "Table (7.1N)". The values of the code's small
  tables are in the code. No clause text is reproduced.
  [[fetched] `_section_7_3_crack_control.py`](https://raw.githubusercontent.com/fib-international/structuralcodes/main/structuralcodes/codes/ec2_2004/_section_7_3_crack_control.py),
  [[fetched] licence](https://raw.githubusercontent.com/fib-international/structuralcodes/main/LICENSE)
- **`sectionproperties` (Robbie van Leeuwen, MIT).** The theory page writes the
  derivations out in its own words and cites Pilkey, *Analysis and Design of
  Elastic Beams*, inline at each result ("is given by [Pilkey]_"), with a
  reference list that also names AS 4100.
  [[fetched] `docs/user_guide/theory.rst`](https://raw.githubusercontent.com/robbievanleeuwen/section-properties/master/docs/user_guide/theory.rst)
- **SymPy's beam module (BSD)** cites freely readable lecture notes by URL.
  [[fetched] `beam.py`](https://raw.githubusercontent.com/sympy/sympy/master/sympy/physics/continuum_mechanics/beam.py)
- **`Structural-Engineering` (Donald Bockoven, BSD-3-Clause)** builds on the
  shapes spreadsheet AISC gives away and states that it is "in no way
  affiliated or endorsed in whole or in part by AISC".
  [[fetched] README](https://raw.githubusercontent.com/buddyd16/Structural-Engineering/master/README.md)

No project was found that cites Roark or Shigley specifically. GitHub's API was
closed to this session, so I could not search code for those names; the five
projects above were picked from memory and read directly. The pattern is the
same across them: permissive licence, formulas written fresh, a citation with a
locator, and a test against a published number. None reproduces a source's text
or figures, and none ships a notice of permission from a publisher.

## Not verified

- Every item marked [search] or [unverified] above. The statute and case
  quotations came through a search tool's excerpts of the linked pages, not from
  the pages.
- The current wording of Copyright Office Circular 33.
- Directive 96/9/EC art. 7 and art. 11 wording, the *Infopaq* and *SAS* holdings,
  WCT art. 2, 37 CFR 202.1(a), and the full text of Lei 9.610/98 art. 46.
- Why and when OpenStax moved from CC BY to CC BY-NC-SA, and whether older
  CC BY editions remain usable under their original licence. (CC licences are
  irrevocable for copies already received, per the "irrevocable" grant in
  section 2(a)(1) [fetched], so an old CC BY copy should stay CC BY. Which
  editions those are was not checked.)
- The status of MIL-HDBK-5J, NASA-STD-5020 and NASA RP-1228 as copyright-free
  US government works, and Battelle's terms for MMPDS.
- Whether a standards body would treat a formula implemented in software as
  "use of the standard's content". VDI's software-permission page suggests VDI
  might. The law cited above says the formula itself is not theirs to license.
  This is the one place where a lawyer's view would change the risk.
- A 2026 Third Circuit ruling in *ASTM v. UpCodes*, mentioned by one secondary
  source ([KAN](https://www.kan.de/en/publications/kanbrief/2026/2-26/the-end-of-the-paywall-for-standards/)),
  was not checked.
