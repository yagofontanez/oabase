import unittest

from oabase_ingest.legislacao import em_linhas


class PontuacaoLegalTest(unittest.TestCase):
    def test_repara_controles_c1_do_html_antigo(self) -> None:
        linhas = em_linhas(
            "<p>Art. 1º Pena &#145;especial&#146; &#150; reclusão.</p>"
            "<p>&#147;texto citado&#148;</p>"
        )

        self.assertEqual(
            linhas,
            ["Art. 1º Pena ‘especial’ – reclusão.", "“texto citado”"],
        )


if __name__ == "__main__":
    unittest.main()
