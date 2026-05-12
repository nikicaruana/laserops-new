import { ImageResponse } from "next/og";

/**
 * lib/og-image.tsx
 * --------------------------------------------------------------------
 * Shared Open Graph card generator. Fully synchronous â€” no network
 * calls, no external dependencies. The Montserrat ExtraBold (800)
 * font is embedded as a base64 constant so the edge function always
 * has what it needs without a self-referential fetch to the same
 * domain (which hangs in Vercel's edge network).
 *
 * Usage in app/{route}/opengraph-image.tsx:
 *   export const runtime = "edge";
 *   export const size = { width: 1200, height: 630 };
 *   export const contentType = "image/png";
 *   export default function Image() { return generateOgImage("Page Title"); }
 */

// Montserrat ExtraBold 800 â€” latin subset woff2, SIL Open Font License.
// Generated from: public/fonts/montserrat-800.woff2
// Embedded to avoid self-referential fetch deadlock in Vercel Edge Runtime.
const MONTSERRAT_800_BASE64 = "d09GMgABAAAAAEE0AA8AAAAArsQAAEDTAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGoE6G4GYahyKVgZgP1NUQVREAIVMEQgKgYoo7kgLhQYAATYCJAOKCAQgBYU0B49lG1SdJewm/OvNqgLQb18/7UhE7pYQabrFRiTlpAfM/v9rgiYykkR3kFrVn5ApGQcYBS8ujWaVXZI0lmdpaw7MrV2T1SF24wIuFGTkQnlwQVESeJ5rL62O91VE+V7dojguW/dwFNJ9bpkjP+5V1t/9FKgIOsTBVZEVnzcNoos4C9EhznjQVf6T4sbdz+72+Wdg28if5OQl/nn//v+rMdZ+535QQQKyJUcAIiN8WYNRR2LWETyPaM5m9jSXS3K5XEQJCQQ8iFhVqBkVf1FowNM38YopVER5Kh6GYG4dWEPdBEYtWRQsWIEsirEGNmDNBmyD0QPHCHEgKNEK+iBYhf9tFDwm+kbxvvrVvt8Fz6NOe5biKv61mzpR7aKSFHIAMCEP2w0rLcOtU4HogMpHxD889+p9GQIBDIZ3hy3qKcgaYgVbC0j/fbX5Vc0MZF8XjXxV7eoiDGZZ1k+iXCfndSXfjJ/vTrKX8w7qWc0+/sbFmWT0C/h/pyYCBQAVkMK+A6yA3RodY/rGcpObsjIu0Tle+ZYjW/qe+gXwn+C+APyDLbPe9mi21uXYVm1ILftCSICd+BEcCQCfgnZt2jRJYHGC+PjidznnTXkgI6fVjBurAg0hKWFgzTd1YkTq9aQAMMDZS5tM9n+6ft/OoFk8D8uhWnwfokVHxekpqai1vEmezKywhkzQLJpFEzTLdohIqR0Vh9NP0Dw0wdSL5ktRNlb9TpGgZbP8hn4Kun1Fa0K9QmMkwn2nDLUohES4bgxO4TDOcmVqmaIxtw+ad/vvM8s3nm9T4O5K4sm9cals6MxierCD2cZyQfAcgNvjGYfDvSH5zmCXxN0COANSjhTlKOMsjaw10aVyJjQuCSj5kKXoPwgVZKpcmUIbKkyVpjJZZnokDLnIpRCVYpYomPjX3nejD/5Ncb3f0jlrnZWVZCXpjYyMlSTrLG8Ymx6MPdtIohSwhu2n71TvPKAbkANkZZZ1Icelj9/VLT9ngvABhwGvAUFIJIh4SVgEGjZLJC1khqzioASVIvRgE6FarQiztYnw50YKFaCikAVoAipBNCVBtCRFTAj34OkRQYgCTgKO2JQzVBkcl4JgQpQHTOcb8FlCI5++/V4IHKRIJ/rwphwzoFysD9YCyk2wvAYgHz2hAKCgATM8uGc10NQy/fDkYABkhFn/YTogPNXc/jAAEigOD2woNAYLFAFYCBCq2TcQAyHSvhdjisk5yyhYEiQgcDpTSMRkGZEMQpvTghZUWL4JRhmqv57KFMiSIl4WXwtg4nsDJqMLMF4oiO/NrGpdFTJh3IgxFcS6TWQhXIIMCqhDQ5KCDja4kEILM6ykhR1OuAkiTOyVkEw0mnZN0eJpoQFjC3Zdpw8GCB5unxsF1zUiQsYiLcPCpvQdpFn7Btlrqbe0uyS2s92uavvakwDRLTAA0CxOxxFTVgEOWF9e8iVc/BtlhVzaIiz0SljRoCvVupSE+kd/Iudv+kU/6jt92Lt9Y9Iud66ip9vcV/t8D3VPdxBkf+Mdbm8729ZQA62st65aoZmqt5yzK21muWWUUlzMQTauMMKTqwM+zm/5Ic/yGcr+IE+ymNu5los5n5N5WbWZHGghOO/KRLZmMN3pSCv7D6Y2/pTGGXPyok1WxMkIO6kTIwXr29twSUps/qFJfsrVyCLAv8vemfKk6rth7PlgtVh7OnGiWBlT1V30gacD2Bd/dxLE4y6o0se7ZcZ1nZBecU6rIIvSB22hV8a5M+5EkW98K8fW0slP17Kqiz7wtGC7YrTvXGdUoGj2FMdRrFhxbDLlwjuOJjt+svFI9jnZsmVPjO5cRtTI8Yj9qv3XKgumXlljRsp4x5YCUGm2HzPvtLrnH9YEGDPSBj/kHUeOgboiX/hptLMaKeNd6IBvDUl1UNWqVWcW+Dy1qfhUsAk3jRkp4y1+JjjmBsxilRucqXz8PzwjBvjCZ7c/9XnYDvlrc7X4b14TB7wy34FdOdasn+blj3f9p3yTLxY+yjt5uPFu3sjlzC09nVfzfC43HvprT3ZkPMPpTecfj20JGUcB7K2Mt+7K5VjnTNHvnx1pMsM9YoQjCjWpEfcbMnGBIY8EHk9vEn1xFzo5V8TrczAOEN10QkYRx31Vxevdp+AM4YJxcAkKoRRVPi3jdmTUFEB/p1h4WrmToo3NiED6ZwF4RYHKp9mg0sbBOOiAY/p3bJWfvOPDDAHVAub4PLXhDIohBD31AI7JeJmdfZocdFVMVeilRrKBk01CwYKbLe+5L8MM2awUA1ne50Ot4Bm1GWRw+8OC4uyFQVGkEoCtXyANQtAEhg7Y9PjLi4qRMJyek0Q+bIAGVNIq37vEtHQIGD4RfO9TAsWcH+59ixtPf1Fnl0j1R+vbtgyxRcco9rj8JjAJw4C+E4oRF/w48RnJDwEdQIbkHw/TUNDOhkyZOd4+G8FhBTU+k1T3UaYaA8vundGWNGp46T+RCViYkIaMIlQ03GxRliro8scO+D4wh3K+5PQCSSrCqRU/tVVM2V5NwEv4UKgkiliEsKVzFo6WEBgEuAeOPnGFLBwCZKQSJXjk96zdLHps0u+FX18aQ7CNCNNm10L/uGv60qG3zP9/D/gsoSPLAQNNpEpKwANR5vNpQJ8C9PemvJS23gUMF/T/avRvRB/ENQG+AP2FA/gEAQ1foCeiQQD8leNM13TwHT/wGQVCrmthSyAHRoSggCOHyyU5xEtABMAOfAsHwABgHn0gCW/dXUwEdQaqI35vKVyjhoULKaI3CbV0LzRXyGuuALsRm8+z0aScbesmtZ2vkF2JIScsoqwMceAKUScFNKULi4tp9yeRSGvQBFESfhuz0ahCoC+caDc7+aJY3UGmU1+9pV4n7Of/4GzojGWceyOowlTHTPOiWbW6e00TIRPXTodlzONQxuRzSzx0hbRUSiCdjiEtuWrnnCIQXiELpm0SO+ltEzc+d5jDAt5xJS55RZrW/dDSIXJR4hT9LED+r2eawKTHiD3YPmUE+X7y3R1+TY96uPjycU5G59R3QT9Kwp7v3RD5Rzjzgn34ITdojYTnmjFr171P7H3VE6EKCzucYaoiUT30Tex4F+zJa4y8ovy3tj5ajjWg12U1r1jHCJNTgY7nMIhMf0TBQZqIX5JTVD+jidLfKahJ+CO4lP6u0505yJW5b8lhwHIfFVxefkCljX7wR8xFsymh2b6xry9Bf1NsWKKZtpnMUdpovq08Hx9EkC+pcNsJbKmUELNMHFI0PFt3oDneYIrLferrW/kn8K0YpnPSCfhYH8qkzlzsFpcJcpS5d7RsntnSdXUR5SZoHFad6W3YQlvSJBK7nzXCveYKWyZeO7oX8XTUPheQBkvVRFbPpJ413DIuWyyBa0T6FYEldEuFJ3djNxLy5OlbjijlNVg1jVyIdlB0Bz/SD5JlaN968UusGl3P7fN4APAof8L7R7lMIk1IgSf/P/hYJAuvQV11fPKn6as3b9UgSNa9yJW63XxBl7Ox4PefO6rceBwRMTG9fpnp2I+4BaW1/UeYu6oFBIFvWkOwzmYmW+3gsMt5bpd0ytKlS7Hf3FPiL4+UVRCpiopSTCNSvoAAQb16Lg0aRGnUKFKTJg7Nmtm1aCFo1SpCmzZaQUFO/1mEsdgSnKWWYiyzjM1yy+mssMI4eyArKbDV0G8XJQpcFuWfK1Y5cF2EYzfQFG7CKd2CR9yxmuuuJMw9q/U86AS+SZOypkypM21a1owZdWbN8syZU2vePM+CBbUWLamybJmyYkVi1aqiV15p89obyltvVbzzToP3PqiyZk3GunXahg2RTZu0LVvytm3bY8eOwGdfeL75xvPLH55//on9918B51DWCGkr9UI8gNZlJaNw0XzcwthEkhhRVCguet5YJJ56pQi3bWQWw/OowI5bNEDDgeJqAiuBNTLCkbHFQXa0CCiKE0eLocMyiI0aSYSJABYArFkIEvdAOA4C3If0vqYAczJwDhBEWHEIjkCANBTIxAG5eKA48VCiRJjiF9dXFUIqEmbxG5S3jls1UywwqGkqM5yvbvX8GJp1CeApBjCLZGxLh67oGzVbOWOzDMb4qfDL90ZnZ2HXYcg8814AQ2o83xf7LwhOoJFej+Duqx/+iSQn/jQtiRZP+mz0yzw2HAqb6rk3bxFiy12nU7trwKYv0S2lxI/MloEHuxFIUM0CLJY0AX8JOMBJWhh5C695R4yaC1dcIdk4ALZqTwtzez6nT/gLX6WKiPLlkmxC2SU5IcIT35Pim2ZPEqEDoBN2RyS6k9yE0WT/FqElK19F/gYgx75nox7VR8elYkvzwUV3sKVO45r8Rm0R1VgAj3VKaex7cCwOSavDQwY6nE8kutvjU5lEtbdnQp/wL6QrZyyUVLJ001bSMvUEk1dq++at1OXVYfmOSCXjVuYcrFNqwrS6p62DAEuBdqHjyKsvqh/FTwkBLIaNlFiAP3P6TSvfl09Y+11Tr0GjJs1atFpmha0GjVnxylvvbCdBKdhvP881Vdg+hUugp6MK36FE24OE6z4i9hfyqe4mkukLojqCRL2A2vhtftALC0Nyq0M31U3r/iGub3maZYrBFtigbQ0UjhBiI4YvOrrfwLU6/tjWLtgLJ1TDh0IkHUnCh/DA0CUSbcrwtQQeRc4ImwHSG4Q1mtV8PgxbDXIQStb42AtW8BlcNWgIsdlmMlfUjSQFWPlDPNVzA7mRigqExOqYht/N+qFVzeclVOIr3MJeYcfBU41tkuomd/0WsPcNUzeFFg0Llo/+yCFUhOO4U0hY8QlUXj60zyZ5dGUflwPkxen1QC+ozvmS4gtFSbbM194Om7T/FOsyuvU3iNNefxFrVXBAmcpJ3Fdi1yXTLwgCg7PXUHwE5oVHmfnevVuitzKCBUOzJ3C1+HiLDC7ls51VYOpT/1/D6lw0CZvjP3ds8XspZ8zVjQ1U+QXe0PGLLbIpHBBNV+SwyQWcwLZ6c7KeFW4jcl3JfKawppMAqbLkJVzbZn9SBzXkJF2HycLLLDcCh2rSUCyEpPzyT4dBX5Wb0EhC2qiR50OKOrPlCHETTtj88q/aay3Ee0oI/bqrFFrzoDYXSnvH3ClP9Ome68/BR/SPe50+QLZ7pJx++A/sfVIRtQB6QZ9Pn+7tkp2+pKEeSo69SVHK7D4lVybZ1uNj/4ldrDtq1QloE7TYEsuttEanLt16DBk2atKUaTNmzVu05L0P1qzbsGnLjv9JPXkcUWZZyh19YVBlCJLPAfKkiCZyjLBzoWgnQkx8WUHqpkBiEpn8MFJGKieXTILJzHNSPckR0qmd4SQ7vWEZ6p4xIPZ7TefwEV48+BERfsVA5h1+P7PfHbuj+6f+d1DLl3g7llnmyqwKtFH20Ley9XVVY+GtiwWDvAWujp5N6dlija5R0K92G8PG9VVXhSPgjBqQKIHTxnLXWKoNojKFtyuWPyJXcUXVq8/vujPslmVQ+oEF6fx3RlppaOm+ODnPnUJmiuO9BM3h471JyAspQBtyfa/MvuHEkACiFQMIdw7CzEqRn8AqBEb2hAY0kSmPSHfUaOAnFvmvTXdTrdZl8j4enWavFO/2eulnXHSw0iQrUVj+atd4m8RcXmlhjd6js7xnR4Xe6qQN+3sqyi28Jf4SXEUHNl3o7ssAyyYMlFjs/xmaV18D+gpySW+Bn+iaS5Y/HonQ+Pfns11ZILeX9/qMxOllNOirTc/cFOPt3TCiePI83QjzjTftAbYGnAYO+ARuGXjNBFUa6ddlVZ5ISq3vcMOoylMRmMprkP30QWU7QmL84xEaHSOPrXSQxdWewT8qYnU3QhqDrI5PeykwDj825DT3rJTllh8pit4/mEtg/DB/QSq+reREsAOTsfteFem8q00tzr2oPebvOsofodQ1dsuarVygPiyL6Q2eeVUsBD8KDqurdMtiC29qa5bUrW8CAL13gRIt3VXNyK55aAqSj1TSsTOKHkSgmBcJNW3rRsjc2S4wEgabjOsG9mvinMWNkuIpS1vqRKUShvOn8FDLloa23J3d9JLS+y+UnlNFOD4brltvwizCBtV4zVCIurqXAp8eNG68rZasP+SsbIw1faAl2S2fC7FWo5eKiJV4uaP2/rsNHdyD6bAZz8s7cM4XmVWonj+TDLqyuO9Aoq6sjw9ETqmJTt9jb/EVMGe+44Zyv37nCS616ajycyn3ep99B+ve7+eNrEZQiI3GMV6b4RzV8teRWn4fkUIumwUVr3asZyJIt/0juY5bHrRq9m1ii7uTVkOmv3aoxLD/Fa/d0TAiDjRRKYajTgVOSbEaLpvERH0EIzlOPPUoDK++f30RIJf1powK4wk27G2Yhj+00HYfSdNBX86QbF9UAVj1RBW/NmL5DcZhH6D/jP2L0AfFk3uAXrRAuukd+zqvY6qDeXnzo8EpiRez+pAJ0zZqedXq49h6DyVBIHuTTgF2Npzq2XoMYhijl1/SZyX6W4TXsIijmgBVnaI9PIpP/upqdlzUFz8FBeKVIBfk7EeQRwc5pyM1ys4OWdA7plxYsNjiy6UqoqwIAct3tDD9GfSmsDd6FMG5YuVun4tbRn0Hbz1kBJQPLrjq5WabJqaUXt78Tf60aLnypteoL7rO+jJ0nNuvnu751uMKIJWqtZfEU88ye3ns6EZtywA2w2I/S7socuYU5Kd4GhjToiZFdoOU28UoOBixMD1NXgSsXtw6r8zYG4QWO/sIsvjWCQRgxmrP7PGyyhz8ILRgeoPT1l5sSqaebCOcmy7SLkMI0dInzWCZvbQnKVKcAHw9jmCmrsa6ENsLaxRJ02OQ1yh0cwWzlvrU+clpjftNNAoqbNoyA5QLgmPFMTzOALn/zWYUpnfKIs87Z6kXzVvtJddsVuu+vRZ47KB6hx3W4JhjGp1wQpNTTmt2U6dWXboE3XXPQg899CpihggqPIEAqYkoGgpkZEQxcUBOTg4uHsgrFiVOPJQgASVRIuTnZ5QkiVqydJwMmbSyZNHIlsMkVy6DPKWilMm2VLlckfrKg9GPUaT+8i01UIFlBrFbqprTGiO5LDVaiWXGqRBpqkrLTFNlqemqRZqhxjIz1Yo2S52lZguIMUej5Z7WZKVnNUv0nPWSvKhNnJeExajVIVVAgEe9elkaNCi2WaNCTZpkaNYsXYsWHq1aFWjTxicoKNN/FrFbbIkwSy1lt8wyaZZbLsoKK0xQHmSlBNhqot8u4ghchhe6giiygCFx3WrHbshy4iah0i0ixB0k1F1czD0k3AMoIdA++7jtt1+idu3cOnRIdMABooMOinbIIaLDDot2xFEuxxwjO+44vxNOyHbSSflOOU12xhlFPnVWqnPOc7nkEpvLLrO64opIV11ldd11pb5zQ7ibOom6dBHddZ/ooYdiPPJIXJJIJCWNlDt5iiBTpBgZUSQCj6eiwhEINNRECg0tio4Bx8hIz8QMWViwrMQElr8hzLVykxRiVCx0TlzQTVXmYBZmYywTmczsIBVKRCqFs4ywBbUElaCo+swu0x96pAGtowxiE2WknmwURUmIPKjfUjUq2FROVZYYHR+EkZStYSv1VV6mKIqRh1zkIREZyEIGIpCn1GQoMhnKS87Cit9iyFkcZgDDzvcYnPCRvY5844HDLPKrz716g7qXtZZfKSc/E7UIWooESXhxnD43+spnZuFQ7RvEYGRDxCCqRRkhChoCDa0gQuuHDm2AFQbDGIJhGCnKYGxDsAyTijYY1xAUQwdpmEQXpAPqoksQ62S6ITwWUIOJOTBtsaokWD5WEgyxWhngHsC9gPsBDwAeAngo4GGARwIeBXg64NmA2CoaAgfZ0XRLHhljMzTzvNizifMhfu8RKhy8fKAwJ33SQcGeLx8pnDue5mQbqy3FQT8rMHSc68rXXxqYEQBBUDg8FTXBNjvs7DAR2nzmzMnazdfrKp6Fz1fXALaWBerrwKA/6PGBztqqCg9oq6331YLQygKs8iLeQFNdELga5osDa7A5GACm0N5bHxwBYRIMmJHpmJoJTGQqMH+qLXoyAxASsA+iMDg8y1pc9qXtT51vd+fzS+7mYsZTGUawiXYfrjjgPrwuYKoRUtAPrpBtOSghYr38gkd5CTEAQn0h8Bn6LcH48tm5i0ALvQP+fdsVzF0sUD4CCpKhRCDAMQj0rs+AHRyxsv65HyCVP0bSL8DguuMwheLckwsZHhBMZWgEzmgxYbHiA9oiWoXYdRQmFgJwR0HQwaE2IBWSPc/CYfTS5+MWoOGgLoRC6E0bjqj+ggWc90dYDUruCNmCQZQQuyzkZ96KRF+j1uCA4PTitf6+GKq3WBKKQouPHgmFEiKEsUgYoDmYSIRogUSHopOpGbSA6LCZ6RhthiI0qNvfBs8Ak28OWHFcF7GsEKF9qnbNsUEshOQcgY8aog2kiwpATSL7NxwRZFBBBxNskoMLPoQQQwo5lFBDS0okFu1LMLYNRbn2aLka/eAVqO9fgwohiWI8DyP0phTw0SobFJWAkMFqW3SsNgDSNLnchxmx7oLVJMsJyKQbrS/fJVfQHbpwGNA31w7cvj38PEZKVPSxXweeCjzD2+7BO4rd1oCzjl3yxjBgezALZwB+ANDTOgecgYJiJqpxcnAO8tKnTn0aAfj/UFwCMZCC9iqSuAAAvGxATlw4gAILOOZfC7w/J7oEuEURBg846VB+2eq8qDvF5BR2Ra/1SI8tpGhKRXlXyhkq3MG4Y9w2t8vtcfvcqe4cdxmuD+8Jfwv/DkH2GLsDh3JLkuNLvwfZtaDLDwBqTPH7Hu22uB0nn+LO/tLA/hu+B+4BMJlwwP/nh3KhLAD873+bmnHUyYDffMw2x+1Vdqrw5JoPa05qw9PHJ1YXQIAbAI/zNADkP/sA5HcXZvIzbBT9n5YvW+aIta545LijttlujZsW2eQ/6yy2xB233LbCMUigpqGjMDIxc3IJ4xbOK06CRH5JkmXIlCVbrl3W2+2BrWXIU0ZFQyePkUk+hyIubsVKVapWo1ZAvZAmzVq0ue2Cne7503KXXHPZdRedLN0ptR6573S5zrrrN7+31kMnrErsV3Ue+9lPfrESi6DxGBwVkYFET+ZgZWOn5RElQqQYPv+Lli5FqjQ54s0iJ1GghEwxJbVcegY5bAqZWWiVKOPh5efzk8kaNVgnqFWV9VLVVBAJh/3chzpauw577LPfXgiHckAqAegzyBIcOQc4/gXA7hDYVgCoigwIHspMt63Ezn2OgIJoimmjn+e0vRbTJb3lKxiQYeLKloyXsFQksXKiijfD6mRJkV1mQ/gBNMXdhEaOtUYPEAgCkaqMGiFA9/ddkrq5mdnL9lBmgV9gEQGMItxikYgl/CtIWPz4S3MzRRm5+uAspG84/5I/aaE2mqe5ysWQjyIsK1Cr98PD3hT6NZyAiDWF46KimCy3KA2jFZ2ioWkBL/OS9yAOsfSNd0kuSeIsIj1Tpg3OMNM6z2ManrVZZulKo7rKkyyJ+BSbjvwoYaDnjEkSbd7mDOPZiR6dukqI8SdcAhpX7ckREo04JfUYFExwa0iEYRNJ7CHQ8TfopS30K2QlNEejs6J5PkGeWNZbLUk5ks+nKC6FVtSqOF8X1RMn0AqcaeKPp9yqRCXksFG+JEaxKREXbwLrRSIFJLrQLbRiNqN0CjIxePaaNwFkwd4XhbRX1KGIalCPylLaiuZigJK6OGcwoRhEHA1V1LDO1ttAADpqoSrBvpSlXoZNqhTesEIgr7Ww2RLq2w+bq1IF8LwzVqt5McDajVxUBkqg4sIIw6bcrahIhBolPevnipHT445Yl2Ih8qISSZGByhsGHpAHlTnokvM5dKrPbErIaCH8Rtoix0i24yrUs1VsjcqmvIXoPnWsCikySFfUq0JGpSgp5CSTrplW1eJVRzQi3bHOegWCL6VTeoT7WSJ4wX1r4N/XlCJYqsTBc0iE6sUi6BnerKR8o/rga3F2ryNyDF26V1PuVJVAEaYfojouvqCZ4FKPtIXN9+Croch6jN3m4aAKsr8h8M4eENSTQgpjoKRAvZaYdxz9OmVUg+qUVcp96GmVnahmqtRtfCpjxZALyeWhHbuV/9zFIaxxBGNQtho0jpFmbQCz7GXBw4DkTZd8IvkyCuVY/hlOfg8DQ8RbvNjeMs2F58MiqFfVnx92zpmdBPjcfxDWlHO5H3iNHFxC7Ve7IMA0cbLo1jiGQdbMO4MkBtWfHsBVbI7TPGM5AlvIFKpZwgxjHw16MD371+9pK4OJwBLT5vEFHAIkZUuMItW/JuanHIWa5RNNN19qKvgCsNOjhDXRKstQLN5tipXtXBQiZ8M/ZUWi3GaQa5NxtHCG/OE6DrgwoIpJZQ+MvPkdIjvLDNC5ZMdQ3KeA5nDe8R9jeJb8CRR/3mVpdD1V9X8Q+NJ4suZDBIYdnxHWOaUucsryGrrdFOoFFlhgtywAfEJrLHbZDzbvdwcHn96ksGK1acs+vvbOwMCTG/SEPdRtLHXiuqsuOIX/c1BzJXzdjpI/c6KGdisn/DsMEJEN+R2fM3wJT+H6P4Gy09JO/2CE7i/tm7CQjeQkthnL3R6ao17bsmOX2vvJzlXJ+peZsLY4ghrKSzT4OALr3yqIptnWaF4KJqgd+iElpD7S+tj5H1a+schtyiPxhQDikHJrZn/J76vT7ZqztWdYzOEte6qCKkw+cZOxQu0RllqHn1gNgXm2btc+YyeJnL8ywmobZnwF98cQrFHZxiCPeQA5NdP7h3MPX0NEkiFCVMW0F/wbgvvfjD5wQiiHz8ah4dn3tdtdogZHBJQbg3Q7DMf9URAgviH8UCzuMfBPqH3kZmP29/GOqqSUuLn7drBpRGOLkMzdYktwd0ex2sHsxhJ9+8ErT2DTevIEGMRsMNvh/zD79dLIF0QK8fkUtmPWy0DyzHAARBONcyZERzWWBwGfkNZRA1TMOBvMlpXWysU/WDTKnkDsddxnFhCMmsZ/mvg7brI9xivUkQNLfUru+cKBqDnjj9B7oWgQ1C+6AKGEcP6df94Xjtxi+JxpJqosi8NVjls9/yB/szoKYlRyS/LlHBajXkCAoyx/Sa8t8ygDAmYrU+xucMOwbDli9o8mCt0Mh1LM3OWfFPgawIuZ9APVidDv4vPvxxlJUTKZZiLJ3w6l7lTywNK8nLjWalXSfpc+9l8H9AGWsHr6co0WnkDqnbOv/++/IUBsq52RvcxQFhl57XtOX4YbK3Afg4dZMiOEDU7j2pFMOUpbjEFeofr4zUf0fuFD+sBn6YmKghrwI5sAADGPTqF1XyebVW6nJXGWccbC+sZxvo0O8Tl9AT4/3l+G/+WnAD5HreIeuN0vj1bCouJ0TuHtYAjIRAfjYqC4S4PyUPnmbHAd1rflN77n6qexQkmbHRx8ixhk7PZiEUtpP7WmxpvbTEspTFO3E8qMuGnHaYorWz6FRtrLFzca4Q8fXBw8gktvVtvB6dK8uViNKz4F08K1fM7Jo2euQvTf81yZXWH3Lt0eOqxCypvK7XPmzNCbPRy1l393lsplYv86lAXuLqjzB6YHBzHv3Hnw5FR/NvRV/2tg6cAZsth864gMGnks9zFAY/bFZK51x8ZCpYDElHNVzV1yjXFlJAOR48kIoJwZ0schcWupmkCkNXdR2HfJSZexZlVmqFZJ2ULeCqcYeqoVVy9K2vV3XEABZR4Il72FMfgYRNwFtBvJYwzeQ0rvGsI1p1hTUclq8PliJama7potg6AZk8EU4MUqLxcWLEERC/D2rEpfrAILyIerFw+KdlsFzjilAg1YfukSOx4mUnunhBHUjvxh1D0MafCSpjYtS/pucdmCwmCTLjkliyyQz6wR4J7kUi9a8aueFmwontOwxDkhI2HuHWATGRPfoKPhjqX2ThWmzhg9U/r8QO+x7U9RDMFOvdsOPTKqPeCUiaugT51DDY0jf7l7fWhbpZXOb4yE4ckM+WJzBmaOppTQpP/Qbqu4QXU62N+EP6L3pZ2jBpU0AnqD7v/+ySbyjZ7V++iXCtXa8NcKaVJ3yQ8PSjbMEaMSXWwLI8FQl7s0K/Ny6GaQ4EN4mtX/7/95u7/Ih+iy5eHyy/T/FB8S8lwQ18cdsz6pANY+uzA102zUBOF9YKxsXNk3R57yDAamNiRtV20H6jn/YF9ZQUamyc/SyPR1DLFZUjReNnJq9Agvi0TK4p0cmODGEAjR3H5wAFo4zPd7BN0mE0CheCn07FCmta9LNKVw6RoUCa1jMomQcoLObUii5crakQ3Uc4bQKxbvztoa7y7lh7p3t4vtDI5VLOFYdBNxO1Aroib2W0KEfj+lnAIHoYUjgtqt8IzyLb6dCiY3o4DCY+pQfLSWxZj887VoBqMQfSAweH438237ywjIKwA5d21uWqzQ6EOph4CarhPQQCxbGHzNKKwSx9Jpcs2brrXUFmyfyKnJb7zWOPtC9+S5uUnY0zUGH0Bzw/yumo0nTuLtfuZPU4vODwz0gt+mhfcZWe/Qs+uCsUvmrs7FforrHNA+z1hLztt99HcQ/64V8e7BiNnTEUeSFz32Jx7KUfBqfNeD3MXLgAuOQM0j6ZVewWajUUChWM2W4fQKr7AOCrsrPMODDtKyTaiz0FpSjtASKS3LoIAUOGbEartqgkf27BE5DItEzLEqEdHG3DkSPCN56aDEEDIZDY2D0tJFmwX6h815TbrA5ixIr+Us+KRu9yQhNpvcfXCdKDU04tD2yOpev/a6nPU8wu5f7S3TzNxYfYpJE3eX173ekyD8wVKutZVIpf/p1XOCqUODrUZDcFBcumgrgH790n9v/v7f/D2l7o4Iat2TGiMf+7aNIknBVsYkzapizDFmlIpB12bKsssHJBWqbqxEPI70IFkp0UWxic+ro98i5JVK1a6VZPv7JeDd5Me7G3c/Sgb90J0vHdvVfa3Dqc6VSlW5zo4r3bua5xxgUmcf/e3uiHBfpc+Cnz9ZfnveXfGG+/Trbt9V9+ufzD7cHymYiQSRnBkwTN774SysGJxd84g8OZz+ymfz6KJZNPidxmzOXPng47b1n7RdXLuS3kwDxPDOp4mqF3YX/TyvV3aD/vI3zjNLxVRj0ilZ5/udOHn31tYupgmicNBZhjQuV1tFMXf6/KxcBMKNT2ZdQKi+tGaCKEigvSQ3jauuoprDZV5WbhKymMj4gdbA8IhS8uigjU+KuSXzfA6wtIv1wgqyUc30K9ZEIfeXoZ6nPkQnY8VvUTG0qLt08unrvoq2RoZOWoe36V9wxyp0uhI0GIPoSkVpGzwlXGlXpNK3KtVhq81ja/YeyBfzxKjj4Li7ZQTHfJaS8pSJI/T0zJ4xQT7EOawxdhQUGNuH1U5XTy5KPa4nB/F4d4+lfuVGIkiuoQWLA2gQfWu2JmyzCq9VqVeXijgbSjxpk4sIN4FjvpOS8oSJwzOf6H19hzk54gbHo44T578ASIipRaCo0ijXesvTVWlmVOvawooeez52Y04d7eCw47jPaejt09m2sDbTabLU8E3usOLVRy7iNcAOKR3V5nXk5+d09Kktps3y3HbnSsTKl8q0GtTSBSaBwDxNxtCiPqDTes/4KqrXMUBhkjcUqiMqoXWsntNP1mAjSdSleftWbxgdGAWqm3nDxNjsbmQZlp2rzJLLoybBDt+p2enD285+oW2Va0MmE3FaZVqVJ4Pb6HROB/CsTZwgGD7G4z/WEwhOeF+LgOSLee/csxphtqycK6wyZ8wnCj9LxSLPMJcDCXYeC4pvUlSwdmbPXhziR/Ka+VhvMDRwE/s6drb4KqS/3jN5lhOAPNB+Nmw4rXcvHvHxWUb7GpvAO76ln7z36ONf/inNXbn4xfwX9w/faxqL9wBJOXEgwZ6aFL5dIZTrAvrYvPfQipA+R+blZgq3nqSgzoVSoTl4iIo+1q2grsE0Q0YvORDHgCavo6Agr31A7XAMqnPby9S5HYMa+wS+C/vge8YoHcTWX69wv9pm71BndzO7o0Njvgb3J0r6tJqO/Hx1x0a12bhZnhd2QCHIfWXIIfJhJoHIvNZJ7f5HJ0+c8Ve0NXPGICqPmNtW6kmTixfp9K3Z6rDVqm5vVe45+9EpFzgedQITMOKYX6WkfMXE/cwxRlfMzJOiDBJEt165Ql7Fwuuz6ZuViNLaPKXctlIxZuJpF6NGTNQJcNx16iPT/S2z58VwjTj3hUu4VUKNVPMnQIhqU3JLZpe1HMlhK2OiWX3KqOzoTSgWX2xqYlkEoYTmzM5mYzSJXR4dHd2vhGTHbEKyuGJjcxo4AMFmQ9Tw8XhyArq0NJHIT0sff1BMJb1Lo3PZv82fcOas7xLnWVoypaXiNJpezbeiGHSjKcSSO7NUck+QB1iQykZ/5YP5e5gfEIQGVvdGFcw0NTIwAnCQrEqeMGBJm4+WfU5Hv32WuWwee2oqdbZKCB5+gLny2lXv+aunPsSA+YuYkzuuWvdcPbDjqnn31aMXMWe7mjN7mkHkH+olNd9lPeqZNy4ZuXzjO1Hlr7q3h24ZVw5fBFM36VbkYUU37GJCsujO6Cdnrp36iodSafPsyfAT3/GvvHIK4BvS3P/oRj6tZxf/WzQK/jmctzuAQlISWegU46IZTrUVa/OOv79U/mcqU8c1mqRi5CgMVh8Hv1e6arQUPNkntKVyDWwOV29PzSyMo+fMxKCnJijBmgkEMxZTRsCXA/Glj+ajZb+2zevMcwfHV/+JS5HjclvYwAp1DlqM+0MhAVrB6Yi49v24FSi7To+yrcD5/xHQNr0ObV8B+pvM+Y+ntHMAG172y7kfOmGEBSZFgVeM51MU24wV+et52SUKQkwWV4+5dwGn2rAbrILqthJNmu07/RgO7xQxOU5Q2D57M1bpn/orPHuzNCNjc2/IJZZX9WQBZE+X4OQd9kk3irib1tO7bFfL7DRIgGrHiHL19hfKMFzuI2J8w9aMecKO+anWMmsCvMy6s7JdKPBKpfLaHiUoh3q35pqm1rUVP3/EERDVIm2akYdyGCG/1FMcs5SQxO/KQ3CyajMUXqVOV71BaB9GH25B0Yx0zOE+FLL5NBiODvILfSbn9WNR2eHfZCAXWtSXnuNVZuW4+tlOZz87x5WlNHj7052D7JEU2iibPUpLGUljUR4RSJ+TyW+RCI9I9QVhpsYqkakd7dyCwjBX7ZBJ1NZ2JvgRmlODrFAGl/SWTIDEjeUiuFPm+LbmmnYEpR/LnsKcapHJCxb9XC+aZgRuqGvIYjoYbDQdUOoqgERjsAbYivbjqRi7TicDqPgnPmif+tFu45vzP5wybXDP6ftTICe8/Jcbh8bWxAe2YunZBPnWfLJ83FRXGOapShQEuCJdz7p7AaPq2A30UOtOGkG7/bsAXihcICZni4rbb9yMUw5MocM3blozMroHQi6xomrAYpzkkw9wJ22oiN3o6WpE7ao/Pg7U0PSaaDeWpNn+bj0mg8S+mJiw98fMW+Qdd6YGy/fIz2nsF4h8com8pn8KNkErtuezuvz0zkEqxoVuST0iU7P1oCaWspl7MsQJy2LvwBfNCL62ca3Cm6XVV28WuYYwD2fQqKNfYLC/XbcjZ34D/5CC/MKQyXl9JsochsqAG+oeSs/1KrNyXcNs16jBznNlKevzHk4vGuS+n0L7gMu7S0u5w2XREgjEBBqVQiQkUOstnZZrX+Po4potG7naWlpr51TLoZIAUiNRU7GDyTa3XohI1wbXZi1sbUO/+Em5Yng5beARxFG/rsIvIQ5nYJ2/guMox4Sk0kYMpjG8xSGg8nQlZ23f6vkgkBzyAIrx8Ojhf1ZLh7HI7SdKeRVujragVC3EfrWyo7bmFx+4AckoT/qZ4X5ggBNJ/NjoK0SFcUPw2R8elzEcHCeZraq1xFS5gwqWGQpOgdHT4FWt77whB+qVNX4HLkP4noQfGa4PVDEE8oe+4Ly+pN9TPf+qMmAH1Ol+gwUvosx/PnYa+BLia6wpUcn86wR5ZDWsnelMOYYQfc2CLkP8i1Um8+hq3DSVzpLnEwV2VEpCIhKNciau/u02uM+vS3/qaA3u32Q8ZgSPIGI7DkmlUewokciBSqBRkQ6c0JosjE8QJCcLEuJTk19DPYqNfQuFeis25jFSWegXZK71ZxWay7PWZvoFYBeErF4TFlzlG2YdjBJXJuP7AiLf11hdmi2tCAqSf927QH+9bURmJiYKweP3Z7fceWAYwlbIODyFmK1MzOOUOwaou/RLkDXcv7h8uYjD+YcHEz3+SDoG9P+R5j4hz+lXcP+lM/7icp8x6N8C8hTp7CT5bMMP3L9foH/QN9fua/Dmf/is3+X/GeHYCCpNTuZsN1KytpkCuc2pykIJdb1hu6Ix0b6CQ6Mqh5fiHikRCsR5+m5TY8JxnIK0ChoUsLfnrdT6L3v7vhc4cimPJ5dE8u1T/w7M9w8R0k5PTaXIldFoioLlJAtuYCYvsvtpiyazpEuF7VI7W4v2aWRPMLKnFbQCpBZUAqQxdYOwdbb/PuVP2+snuqjbI8eHh7smuwDJF3fw5WMyACD/eA44LZZGjaHRYqhuF8Crp7cwGC10xpcTSHtznDQOPl/3yzqHnvIrK3+pBHOXJI6sHwaCAmo+LW8UfRoOA2ABEZcUjcIFEFDmtNSheA8E5AUYL1VVlbt3JjbBCeMEeHPCTvfSR5ViDEbMJnZyTx/9NO7To6e5nW7HYWNg1aWxNUWD1oxlEXec0AzHj+PhTYn5QHVphjsW6g0RKD9rxJ3pbGO4gSMXL6YwPP5QNt5Syf7k8RpYW3G9zCqQxNc+krkc0w0uDF491nu1dwHAdQ/SW2oNXR36a8yfXEXct5oIIPcCJ1Qbw9lHvd7sI50bTqnqa15WtDdl7ylyCTZ6FTKD1WomRED25xzkEKZi4a+vUQq03Ba3dTPLZNrMK3ZzOww5nI1udxfPxCmLW06qXtiICFwXlUkkDTk54voyiVhhE9MDebkpDRYxog9zbhuZPH4Og77ZRSZtvgnqV+0NYo5qMBkCUxVDoyilphv4LJahVKbHLpY3I+LGfsILPZnqutW5O5jx/uDUEWuFqZ2rdWSuZVv8GiNOfaIzJv4cGgNNgB6LeKdBAz71XbjoYQtsIonE3pBmaNVPL5QvgD9rU60wQ9JWfqfGi04lC+PgS8XyVT9xIAyBzLJQYpv4OAG+LFe+Wg7PWsnkZ5ir2Rn/lViPFiTd37grHsXIEBQ2sx2YnCgDfC+/s7kgNpWzPj7mE9c/v6j+YnGlFtAVadiYXlLK36jXp29UTme6wdDJLy7hd6ie3llaanvVG0TeVJ2eVi4SUcs0Oi9NLPKl6AwlRCiklmv1Zm2OrIS71nEBAfUmkxVlsGuE1+HxcZFKJFIZGRcPv16DsZRrhRhL9ru3tt/X4JaFW3Wf6M77LB0vFTj18mynOp9XeZGOepaE+ApFBzfQe+vPxAmPxwUi9oQjvovvvC7uvY74flbc55v09YvBvXJOAZNt5HJEymdxeaBJDrdYmVwHwmpJIh2RZLESoLSPRaNhxBcqfT3x8gwsfcUvF7+kc/NoZ+q+PwBrhQGXPN1NU6uorvR0CVGr3dT0DNDiJFHZHLihsrq2rqqmSp8g63W1eUSByq2uTtuUjP4Ii/0Ik4zF3NfMffQfj17B6+VefWaxc56rerHlRfD3GVtgRX4dNYof4KuhiawAVumvXrQXNfC4uyAcM1Rq6plU10r9CeWCyY/VMILOqFBuIcVMVU9VkYIrgiCey2yxRrz5X1s7aLtiiaC3cBsNHoIHPzAdAHxa/970e8pD49+OA0FcYHphQ7m/yOVT5S4AKMpz+/WbmCZ6amNKSmMqvYn24qJKKh2+5jYBwbaxb8e++edhBgLn+Klps0+MfyMaoDgDUGL8ZAOYCXz63vXp68r36nlsG/p2CGz7iaB9WRuLeBjdFOG1V6mIVWgmHPEWaAKmajBc+VIhzFLAGjp9cIKlrdOhgiAYeH9265Uwynn5TKZNLGZa81k8vonFskjELJuJyStGQtPTocgkZmLMZTNmMUKBicWvbhULCExVDMIEZF+NfD19g33+oNbWMN4AWIkxoIEj/Pgk5zk3/h0i8V08/t204ju/RiZAd9GbGWdMd2E0g2XFs5PzPZPgRnGPolnDVtw1eQhSx3A44AroFnOtJVIfwl7G4xdhoQjVbyig55FfSyGSaMfJlAM0EjHlNZIK8T8CAZKS1iARa8B6G2pT4nFY3IYkd4Q2yyJEjUEuQeMGl7uBSmkF/hb/oB/IdMfuiKJje+IwVyjah4sY6oV4PCVNCZZ/jTBAEPqFL2NR9atX5ySREXW+dx9uRLMta0GF1n3I6joENnyDOpC0uAY+klgSoVE6xOhx2iIsbnh5MVAr7UBPabvcBupV6G3akJwBoDv4f9Lpf/L5v9GZz8BYEe4YjjCDw80QvrFvks8V6Wwy7iz/HIAU7w+frwqD28VVivbd8fV2zJaHr8DgdngJLEuVSYnSw+FVkS6YXAX8tZ5BD9CZ3xD+AhGxsPgNb9G/RjBdFNzLYLM7+Xki8fnk5JCPab/i9C5ogrmPmf7Bl2eptuHlKag9loH3j1vat1wH/gr0Pd/3XOdrz4+M3Fd5y/NbuM2nvf78KLDnQWAvDIz2PloJ+MiXFZx5gBDmDAUq7e3CLu5HQ2HqJuMLmjRHNsV+zdb1yRIExXBzCG0XiplPzHTXxnBzCG0XKhU+nvBTbW+/7CVBMdwOQggT6N4cd6KQCr9SS2ZjBUU4hNesUXa2C0ukPLEuRgN5FNdGqG2oaBUTWHmT8UTWow1j1DjkUhOjaOBozo6fuaAUy8SmxabGEo2yRyj2PI2hJiGNjatjwvIoro1Q21BtzDsSTGxOHZOAKK5eCIyi57ADA3sJAWzQd935Bmb3aBcEanhOe0ZlAuz24F2QU1V7T3tf+0D7UPtI+1j7RPs0/NncjSqRhK/dj3kZ2PN+a4FJ+3CWHyTGwm4WxD7Qqf7T78YGoUSLvIpDac8RHLCHzsqY9mDnPVnO2rV21qF1sEM7H3KHHdYOs6NGOuQxsNvBOljQ+rwwgb0kOl9AxA8hSIZv78Q6aEXz3GtO+3szQWeDAxKAL8QmxvilnMNxcT5PByTS+kP3zy1DxyIA//2DXo6Ff72OCSAE4P07apgQ/dTnunK0H94Lyck7t2yH1DoWwWeeoEljdkmbu40Eg222FEsoQYy/VFrTBTkuzrWEftWlHJx3jGo70zCdXvUw9CdnIzUjxRjGMRUTmC5s1KHjgHcltIOr39z59+/Pi/okb2xxHXQeCqypy0XwwjMQ4T9wXelesJ/bgcnKdcYa4WqT5ZmNaR+9uDt4Run93pzHYF3QORWgLxvxo4oxSuetaJwOeA107v3ENTab7UNs6TeS2a7FgI8KjpVhmRZpUKiooYt+pI0deGSugX7/FuKaexX09yp/07yVh9YATh6lplINqIqeDzl/09jRIEcuklyQ106Nc1o9DPDoOV/Vv+QAs86aZcD/ufD1pCdptHc+6GsWkICNPir4dxkWz3DFGS6HFh/S/j7i73Nn0tt69L/RoF9cpOf1rn5PGyX7uqA8mIOzUBqooZqb1ASApb0wAKNKD7WnpyyA6ZSkUFu7JfYA658cjdshmrZ1eTTp6Bc0NNSnXawgE7XiQ1p3SGMTtfnekjnEwVKXw6GQrOsyckFIm7wlN0zPavMWhbD07GOyI4c7N0fn09xdevlT0LZi1dSV91e/lxT/KNbUWbjHmPrzFM/Df7c+sY78unZ3qp/2EK6L7ULlYb9bR8wbs488nDdnt6f6Sz5fYz3rT3l/w3oJ+Eexpj+UhdKzv2Z0jRjTf/K0RtsCheF5+O9pJ/b7/LrxUBHbPkrNguH/K4SWVN+4lQln/mEfZXLds3U0eWP2e6rF+bx/69mSjPZ32zRQGB6Oge3HGvPqylOdmz1/LgBPbWt+7Ad+HCWHqUSkLSvIzZALuj+G/U26vp/J1h/CrP/y+m7d+dM9/xXYyab7rb/+/8mcuPC0EQJX38eLEDgQvOPbNzxjdeK/8auoS4Bf/N2vgN9f9M6s/2OG297ceMAOAQj4xyr5ZEf436Aih9L3H1muq0H0ip2uL2EzdLAioKLv8BhLqGK14uPumyXQpuSK7CNKMoU08DG/Bg5MB+60bi5zrvUHm3gRWOcrUrooj0fYmhv0YxUAueDPvmUfYzegl6yIbP1vurZ9pNEpJtRTcw3d6yhvQ1zC+rKjnpHfInZ6vg4G6LtplrBkAt21sJ6VH4FoKBrlJuc00CNBTmaWtcUaKJ+vkerhdoCwxVfv2S6aZhc2qjqWImj2zGqQSO4FEnSb7r9yd1U7d9bcPGnNhPJStMsQ3kfo7s7LV8x5lSJ5NV7iyXPYDpuHLZrHnWNvCb5BnrYydzcXUcmikYxrsRf7YvY6jsFZOCobnpdpgctjmrwii/XYEpMw9zYhVk3MhizCrOw1L4AI3h2RF2ntZHaKOSDal3MgUySkWuZBe+Ki5M9GpwVCj9Bn7xyd/O31L/BdkDdJyi9g/QUAUOv58gpNKHskNRTTrCIs9pEuHtiu9qfWNbcwaqikUliokrtidFm21eDpD/aurlDXzLBWgAfpDbdMELfs7dxuWYQqFK6DuTmm9bzb4nH1GOV+nGtjXVmPHED/WeVQgs55+ZfzRVYXU+2KaO9S4IXwVPuVBN+H2+Ax8AN4PjwMngafgcdWeyJinyps7O8THeXm34e//KY8Qk77INwOzwt+Ryb4Y3v4ufUWWlq7pwR6wjYYDj/CWKsmX2Y8RhexjJbZKCK0PKxbB0H2OSxXYSn0TqucO8zv6WUmKgBfyZq3oJRILYQ2UwulzGKQbm9h2CxpYSVpa9HKMLBF4pK2n57Mcx4EOIQJQasJnJrwkrgIwH3q1fEI0Alp61pVfGzK3zYVKoWotAoJ8shSr1aZXPUCQhqVC/JkITiDVaoSsM+GNHQKQn5+GGVduQA/C3FeQ9csy5xQs0JO3tVi9k9WG+NEVS69cbIlSvooSZ96cw2RQ0EkDAVPmQpNankEfa2FcyWlx13rBQN4WZwUSZIlO90l5XA8WX9B9aqV871kizWpqiTu653HiQ5uvkZVa+8mXiwTl2YxTU9NYabyZUoWP2adtjwF8X6D5qNS/ExnH3COrRHYbIKXTPSyN0XymYTqsmiTvWGb7WLEihPfEthhp112x0V4xafg2mOvGm96yx/+lOq6NOkRE8Zv12GqR7LlyPXZq/IjVSlVHfJ19kW4gvriM1UaguGuo4tH8KIfe1qzlmh4Jgb6xEZaeNu1KrDeBmFt9qv1mkG+M5iF1YBh7Dp0qrcgphu/y35jGZ7VRWt95vNWgCHqg22JmrDWEQRVsU0aUfxmrEUdSolJbOCJS3wSkhhl5VJWuO2Ou9FW0qjwd31SQw8jTHo6Ti6/oH3D42vrtdJgyQpjJY3kb/8osYpojFJSRa7a6F//WWSxn/xsldUYAi+VNi1esdCrGmOHY6ynmqzElaLZ+/Fo3dRpCbdwYd4x3iF/TUX45cdkWCuTgJCImISUjJxCFqVsKmoaWjp6Bjly5TEyyVegkJmFlY2dg1MRF7diJUp5ePmUKedXoVKVajVq1dUopRFPjHi4caNeg3WCrbjPzXcTbyxWn/dm1jTPt9W52y4HqtJ142Erfmje5ngJX9McICa2XkaE9J2faY/31ls/mxs99G/kP+axeLB8h0KG1Jlv206N+eMhn3HC4zfjzzsFcqWAFN9mlfJHkXDmoCAjU4AxRUYbzghkkSGLP3FGCOZbu+LAhAMhgIzAFIHgwCcBwQIcCEwxNC4UrtbwDNLEYRLPtou1QlMe42pcprJHhGavDgQO5/zekHxcauIXgiblPcK2lPcw0yzjPAZQ0MWI9Wjo0Tzveft97gF+KGhi2bnQCSEuQZhHI5vaDbQDl/qmcnPdaRJ3FmyhwNpRaggiextrzXq4PBDKeW2JHwuclMGZyZe++L5ESFy1UKkn0TRMi5HKvZ2OsI0LLA+X7fvA2vgr883DtprhusQJTx7nNxgPkG9lpohRJzoJT1sUxAn5IgqZU5eQgUJE8rVnIhGS8CKGovKtzBQyVJmcOeSKRPBKOxhAWIE5dmDNcc1DLDy45q6eNsaJJ1mT05AwpyiRENiGVmaGZhrao/3QdXVPFDUc9rlYSD1D5KTMbFxjmGLIZasyNr9j5+LnN0S5w+PzNwEA";

function getFontData(): ArrayBuffer {
  const binary = atob(MONTSERRAT_800_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}


export function generateOgImage(title: string): ImageResponse {
  const fontData = getFontData();

  return new ImageResponse(
    (
      // Dark card -- no external images, no network calls, fully self-contained.
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0a0a0a",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Yellow left accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "8px",
            height: "100%",
            background: "#ffde00",
            display: "flex",
          }}
        />

        {/* Yellow bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: "#ffde00",
            display: "flex",
          }}
        />

        {/* Subtle diagonal texture lines (pure CSS, no fetch) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.04,
            backgroundImage:
              "repeating-linear-gradient(135deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 40px)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: "72px 88px 72px 96px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Brand name */}
          <div
            style={{
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: "22px",
              color: "#ffde00",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            LASEROPS MALTA
          </div>

          {/* Page title */}
          <div
            style={{
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: "82px",
              color: "#ffffff",
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              maxWidth: "880px",
              display: "flex",
            }}
          >
            {title}
          </div>

          {/* Tagline */}
          <div
            style={{
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: "14px",
              color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            TACTICAL LASER TAG - MALTA
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Montserrat",
          data: fontData,
          weight: 800,
          style: "normal",
        },
      ],
    },
  );
}