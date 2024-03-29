import React, { useContext, useEffect, useState } from "react";
import { Flex, ButtonGroup, Button, useToast, Spinner } from "@chakra-ui/react";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/mode-json";

const UploadABI = ({ onSubmit, ...props }) => {
  const toast = useToast();
  const [text, setText] = useState();
  const [json, setJSON] = useState();

  const handleVerify = (raw) => {
    try {
      return JSON.parse(raw);
    } catch (err) {
      if (!toast.isActive("upload_json_fails")) {
        toast({
          id: "upload_json_fails",
          description: err.message,
          title: "Could not verify JSON",
          position: "bottom",
          status: "error",
          variant: "subtle",
        });
      }
      return false;
    }
  };

  useEffect(() => {
    if (json === false) {
      const clearingInterval = setInterval(() => setJSON(), 200);
      return () => clearInterval(clearingInterval);
    }
  }, [json]);

  const handleChange = (change) => {
    setJSON();
    setText(change);
  };
  const handleSubmit = () => {
    if (json) {
      onSubmit(json);
    }
  };

  return (
    <Flex
      // minH="420px"
      // h="100%"
      w="100%"
      minH="100%"
      // maxH="420px"
      // overflow="scroll"
      flex="1 1 420px"
      direction="column"
      pb={2}
      borderColor="red.900"
      borderWidth={json === false ? "1px" : "0px"}
      transition="0.1s"
    >
      {/* {updateSubscription.isLoading && (
        <Spinner position="absolute" top="50%" left="50%" zIndex={1} />
      )} */}
      {/* ABI HERE PLEASE: */}
      <AceEditor
        // style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        style={{ minHeight: "420px", padding: "4px" }}
        width="100%"
        height="auto"
        mode="json"
        theme="github"
        onChange={(e) => handleChange(e)}
        name="AbiUploadField"
        editorProps={{ $blockScrolling: false }}
        // readOnly={updateSubscription.isLoading}
        showGutter={true}
      />
      {/* <Divider /> */}
      <ButtonGroup pt={2} placeContent="flex-end">
        <Button
          //   isLoading={updateSubscription.isLoading}
          onClick={() => setJSON(handleVerify(text))}
          transition="0.3s"
          colorScheme={json ? "green" : json === false ? "red" : "blue"}
        >
          Verify
        </Button>
        <Button
          //   isLoading={updateSubscription.isLoading}
          disabled={!json}
          onClick={() => handleSubmit()}
          transition="0.3s"
          colorScheme="orange"
        >
          Submit
        </Button>
      </ButtonGroup>
    </Flex>
  );
};

export default UploadABI;
