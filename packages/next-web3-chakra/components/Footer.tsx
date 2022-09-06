import React from "react";
import {
  Text,
  Link,
  Box,
  Container,
  SimpleGrid,
  Stack,
  Image as ChakraImage,
  useColorModeValue,
  VisuallyHidden,
  chakra,
} from "@chakra-ui/react";
import RouterLink from "next/link";
import { FaGithub, FaTwitter, FaDiscord } from "react-icons/fa";
import moment from "moment";
// import MoonstreamContext from "../core/providers/MoonstreamProvider/context";

const LINKS_SIZES = {
  fontWeight: "300",
  fontSize: "lg",
};

const ListHeader = ({ children }: any) => {
  return (
    <Text
      fontWeight={"500"}
      fontSize={"lg"}
      mb={2}
      borderBottom="1px"
      borderColor="blue.700"
      textColor="blue.500"
    >
      {children}
    </Text>
  );
};

const SocialButton = ({ children, label, href }: any) => {
  return (
    <chakra.button
      bg={useColorModeValue("blackAlpha.100", "whiteAlpha.100")}
      rounded={"full"}
      w={8}
      h={8}
      cursor={"pointer"}
      as={"a"}
      href={href}
      display={"inline-flex"}
      alignItems={"center"}
      justifyContent={"center"}
      transition={"background 0.3s ease"}
      _hover={{
        bg: useColorModeValue("blackAlpha.200", "whiteAlpha.200"),
      }}
    >
      <VisuallyHidden>{label}</VisuallyHidden>
      {children}
    </chakra.button>
  );
};

const Footer = () => {
  // const { WHITE_LOGO_W_TEXT_URL, SITEMAP } =
  //   React.useContext(MoonstreamContext);
  return (
    <Box
      bg={useColorModeValue("blue.900", "gray.900")}
      color={useColorModeValue("gray.700", "gray.200")}
    >
      <Container as={Stack} maxW={"8xl"} py={10}>
        <SimpleGrid
          templateColumns={{ sm: "1fr 1fr", md: "2fr 1fr 1fr 1fr 1fr" }}
          spacing={8}
        >
          <Stack spacing={6}>
            <Box>
              <Link href="/" alignSelf="center">
                {/* <ChakraImage
                  alignSelf="center"
                  // as={Link}
                  // to="/"
                  h="2.5rem"
                  minW="2.5rem"
                  // src={WHITE_LOGO_W_TEXT_URL}
                  alt="Go to app root"
                /> */}
              </Link>
            </Box>
            <Text fontSize={"sm"}>
              © {moment().year()} Peersky.xyz All rights reserved
            </Text>
            <Stack direction={"row"} spacing={6}>
              <SocialButton
                label={"Twitter"}
                href={"https://twitter.com/iampeersky"}
              >
                <FaTwitter />
              </SocialButton>
              <SocialButton
                label={"Github"}
                href={"https://github.com/peersky/daococoa"}
              >
                <FaGithub />
              </SocialButton>
              <SocialButton label={"Discord"} href={"https://discord.gg/hkXgaqwr"}>
                <FaDiscord />
              </SocialButton>
            </Stack>
          </Stack>
          {/* {SITEMAP.length > 0 &&
            Object.values(SITEMAP).map((category, colIndex) => {
              return (
                <Stack
                  align={"flex-start"}
                  key={`footer-list-column-${colIndex}`}
                >
                  <>
                    <ListHeader>{category.title}</ListHeader>
                    {category.children?.map((linkItem, linkItemIndex) => {
                      return (
                        <RouterLink
                          passHref
                          href={linkItem.path}
                          key={`footer-list-link-item-${linkItemIndex}-col-${colIndex}`}
                        >
                          <Link {...LINKS_SIZES}>{linkItem.title}</Link>
                        </RouterLink>
                      );
                    })}
                  </>
                </Stack>
              );
            })} */}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default Footer;
